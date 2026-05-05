# Parent User ID Generator - Complete Documentation

## Overview

The Parent User ID Generator creates unique, formatted email addresses for parents/guardians based on student and parent details. These IDs serve as authentication credentials for parent portals and follow a structured format that encodes key information.

## Format Specification

### Standard Format
```
father.student.c{classNumber}.{serialNumber}.{sessionYear}@{schoolCode}.schoolos.edu
```

### Components

| Component | Source | Rules | Example |
|-----------|--------|-------|---------|
| **father** | fatherName | Lowercase, spaces removed | "Suresh Kumar" → "sureshkumar" |
| **student** | studentFirstName | Lowercase, spaces removed | "Rajesh" → "rajesh" |
| **c{class}** | className | Extract number or use as-is, lowercase | "Class 5" → "c5", "LKG" → "clkg" |
| **{serial}** | serialNo | Serial number (no prefix, unlike student ID) | 1 → "1", 112 → "112" |
| **{year}** | session | Last 2 digits of first year | "2026-27" → "26" |
| **@{schoolCode}** | schoolCode | Lowercase school code | "GVS001" → "@gvs001" |
| **.schoolos.edu** | Domain | Static domain | Always ".schoolos.edu" |

### Examples

| Parent Info | Generated User ID |
|-------------|-------------------|
| Father: Suresh Kumar, Student: Rajesh, Class 5, Serial 1, 2026-27, GVS001 | `sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu` |
| Father: Mohan Singh, Student: Rahul, Class 9, Serial 112, 2026-27, DPS | `mohansingh.rahul.c9.112.26@dps.schoolos.edu` |
| Father: Patel, Student: Priya, LKG, Serial 5, 2025-26, ABC | `patel.priya.clkg.5.25@abc.schoolos.edu` |

---

## API Endpoint

### POST /api/students/generate-parent-id

Generate a parent user ID for a student's parent.

**Authentication**: Required (Bearer Token)

**Request Body**:
```json
{
  "studentId": "cmojjcvdf00011gaz238j4g36"
}
```

**Parameters**:
- `studentId` (string, required): The unique identifier of the student

**Success Response** (200):
```json
{
  "success": true,
  "message": "Parent user ID generated successfully",
  "data": {
    "studentId": "cmojjcvdf00011gaz238j4g36",
    "parentUserId": "sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu",
    "studentFirstName": "Rajesh",
    "fatherName": "Suresh Kumar",
    "className": "Class 5",
    "serialNo": 1,
    "session": "2026-27",
    "schoolCode": "GVS001"
  }
}
```

**Serial Not Generated Error** (400):
```json
{
  "success": false,
  "message": "Student serial number must be generated first"
}
```

**Already Generated Error** (400):
```json
{
  "success": false,
  "message": "Parent user ID already generated",
  "data": {
    "studentId": "cmojjcvdf00011gaz238j4g36",
    "parentUserId": "sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu"
  }
}
```

**Error Responses** (400/404/403/500):
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## Complete Workflow

### Step-by-Step Process

```
1. CREATE STUDENT
   POST /api/students
   ├─ Returns: studentId (serialNo = null, parentUserId = null)
   
2. GENERATE SERIAL NUMBER
   POST /api/students/generate-serial
   ├─ Input: studentId
   ├─ Returns: serialNo (e.g., 1, 2, 3)
   
3. GENERATE PARENT ID
   POST /api/students/generate-parent-id
   ├─ Input: studentId
   ├─ Requires: serialNo must exist
   └─ Returns: parentUserId (formatted email)
```

### Example Workflow

```bash
# 1. Create Student
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Rajesh",
    "dob": "2010-05-15",
    "gender": "Male",
    "className": "Class 5",
    "fatherName": "Suresh Kumar",
    "parentMobile": "9876543210",
    "session": "2026-27"
  }'
# Response: { "data": { "id": "cmojjcvdf00011gaz238j4g36", "serialNo": null, ... } }

# 2. Generate Serial
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "cmojjcvdf00011gaz238j4g36"}'
# Response: { "data": { "serialNo": 1, ... } }

# 3. Generate Parent ID
curl -X POST http://localhost:5000/api/students/generate-parent-id \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "cmojjcvdf00011gaz238j4g36"}'
# Response: { "data": { "parentUserId": "sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu", ... } }
```

---

## Implementation Details

### Algorithm

The parent user ID generation follows this logic:

1. **Validate Input**:
   - Ensure studentId is provided and is a string

2. **Fetch Student**:
   - Retrieve student record with father name, first name, class, serial, session
   - Include school code information
   - Verify student belongs to authenticated user's school

3. **Check Prerequisites**:
   - Verify serial number exists (must be generated first)
   - If serial is null, return error

4. **Check Existing ID**:
   - If parentUserId already exists, return error with existing ID
   - Prevents duplicate generation

5. **Generate Format**:
   - Clean father name: lowercase + remove spaces
   - Clean student name: lowercase + remove spaces
   - Extract class number (or use pre-primary name as lowercase)
   - Get serial number (no prefix, just the number)
   - Extract session year (first year's last 2 digits)
   - Lowercase school code
   - Combine: `father.student.c{class}.{serial}.{year}@{code}.schoolos.edu`

6. **Update Student**:
   - Store generated ID in parentUserId field

7. **Return Result**:
   - Return studentId, parentUserId, and all components

### Database Schema

```prisma
model Student {
  id                String    @id @default(cuid())
  schoolId          String
  studentFirstName  String
  studentLastName   String?
  dob               DateTime
  gender            String
  className         String
  admissionDate     DateTime?
  fatherName        String    // Used for parent user ID
  motherName        String?
  parentMobile      String
  alternateMobile   String?
  address           String?
  session           String
  serialNo          Int?      // Must exist before generating parent user ID
  studentUserId     String?   // Student authentication ID
  parentUserId      String?   // Parent authentication ID
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  school            School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  
  @@index([schoolId])
  @@index([studentUserId])
  @@index([parentUserId])
  @@index([session])
}
```

---

## Rules & Constraints

### Prerequisites
✅ Student must exist
✅ Serial number must be generated first
✅ User must have access to student's school

### Format Rules
✅ Father name: Converted to lowercase, spaces removed
✅ Student name: Converted to lowercase, spaces removed
✅ Class: Extracted from "Class X" or used as-is for pre-primary (lowercase)
✅ Serial: Numeric value without prefix (unlike student ID which uses "S" prefix)
✅ Session: Last 2 digits of first year
✅ School Code: Converted to lowercase
✅ Domain: Always ".schoolos.edu"

### Idempotency
✅ Once generated, cannot be regenerated
✅ Attempting to regenerate returns existing ID with 400 error
✅ No duplicate IDs possible

---

## Service Functions

The `parentUserId.service.js` provides reusable functions:

```javascript
import * as parentUserIdService from './services/parentUserId.service.js';

// Generate parent user ID
await parentUserIdService.generateParentUserId(studentId, schoolId);

// Generate format (utility)
parentUserIdService.generateParentUserIdFormat(fatherName, studentName, className, serialNo, session, schoolCode);

// Extract class number
parentUserIdService.extractClassNumber('Class 5'); // Returns "5"

// Extract session year
parentUserIdService.extractSessionYear('2026-27'); // Returns "26"

// Check if has parent user ID
await parentUserIdService.hasParentUserId(studentId);

// Get parent user ID
await parentUserIdService.getParentUserId(studentId);

// Validate format
parentUserIdService.isValidParentUserIdFormat('sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu'); // Returns true

// Reset parent user ID (admin function)
await parentUserIdService.resetParentUserId(studentId, schoolId);
```

---

## Error Scenarios

### 1. Serial Not Generated
```
Status: 400
Message: "Student serial number must be generated first"
Solution: Generate serial first via /generate-serial endpoint
```

### 2. Parent ID Already Generated
```
Status: 400
Message: "Parent user ID already generated"
Data: Contains existing parentUserId
Solution: Don't regenerate; use existing ID or reset first
```

### 3. Student Not Found
```
Status: 404
Message: "Student not found"
Solution: Verify studentId is correct
```

### 4. Unauthorized (Different School)
```
Status: 403
Message: "Unauthorized"
Solution: Ensure student belongs to your school
```

### 5. Invalid Input
```
Status: 400
Message: "Student ID is required and must be a string"
Solution: Provide valid string studentId
```

---

## Test Results ✅

### Test 1: Parent ID Generation
- **Student**: "Rajesh", Father: "Suresh Kumar", Class 5, Serial 1, 2026-27, GVS001
- **Generated**: `sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu`
- **Components Verified**:
  - Father name lowercase & spaces removed: ✅
  - Student name lowercase: ✅
  - Class lowercase: ✅
  - Serial numeric: ✅
  - Year extraction: ✅
  - School code lowercase: ✅
- **Result**: ✅ PASSED

---

## Best Practices

1. **Order Matters**:
   - Always generate serial before parent ID
   - Check for errors at each step

2. **One-Time Generation**:
   - Design UI to disable regeneration
   - Store ID safely

3. **Authorization**:
   - Always verify school ownership
   - Use authenticated requests only

4. **Error Handling**:
   - Check for "serial not generated" error
   - Check for "already generated" error
   - Provide user-friendly error messages

5. **Data Quality**:
   - Ensure father names are properly entered
   - Verify class names are consistent
   - Confirm serials are generated in order

---

## Examples

### Example 1: Standard Parent ID
```
Input:
- fatherName: "Suresh Kumar"
- studentFirstName: "Rajesh"
- className: "Class 5"
- serialNo: 1
- session: "2026-27"
- schoolCode: "GVS001"

Output:
"sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu"
```

### Example 2: Pre-Primary Student
```
Input:
- fatherName: "Patel"
- studentFirstName: "Priya"
- className: "LKG"
- serialNo: 5
- session: "2025-26"
- schoolCode: "ABC"

Output:
"patel.priya.clkg.5.25@abc.schoolos.edu"
```

### Example 3: Multi-Word Names
```
Input:
- fatherName: "Mohan Singh"
- studentFirstName: "Rahul Kumar"
- className: "Class 9"
- serialNo: 112
- session: "2026-27"
- schoolCode: "DPS"

Output:
"mohansingh.rahulkumar.c9.112.26@dps.schoolos.edu"
(Note: spaces removed from both names)
```

### Example 4: Senior Secondary
```
Input:
- fatherName: "Sharma"
- studentFirstName: "Arjun"
- className: "Class 12"
- serialNo: 45
- session: "2026-27"
- schoolCode: "ABC"

Output:
"sharma.arjun.c12.45.26@abc.schoolos.edu"
```

---

## Comparison with Student User ID

| Aspect | Student User ID | Parent User ID |
|--------|-----------------|----------------|
| Format | firstname.C{class}.S{serial}.{year}@{code}.schoolos.edu | father.student.c{class}.{serial}.{year}@{code}.schoolos.edu |
| Serial Prefix | S (e.g., S1) | None (e.g., 1) |
| Names | Student first name | Father name + Student first name |
| Case | Uppercase C/S | Lowercase (all lowercase) |
| Example | `rajesh.C5.S1.26@gvs001.schoolos.edu` | `sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu` |

---

## Related Endpoints

- **POST /api/students**: Create student (parentUserId = null)
- **POST /api/students/generate-serial**: Generate serial number
- **POST /api/students/generate-student-id**: Generate student user ID
- **POST /api/students/generate-parent-id**: Generate parent user ID ← NEW!
- **GET /api/students/:id**: Retrieve student with parentUserId
- **PUT /api/students/:id**: Update student
- **GET /api/students**: List students (includes parentUserId)

---

## Files

**Implementation**:
- Controller: `src/controllers/student.controller.js`
- Service: `src/services/parentUserId.service.js`
- Routes: `src/routes/students.js`

**Documentation**:
- This file: `docs/PARENT_USER_ID_GENERATOR.md`
- Main README: `PARENT_USER_ID_README.md`

---

## Status: ✅ PRODUCTION READY

The Parent User ID Generator is fully implemented with:
- ✅ Complete API implementation
- ✅ Service functions for reuse
- ✅ Comprehensive error handling
- ✅ Authorization checks
- ✅ Database updates
- ✅ Test scenario passing
- ✅ Full documentation
- ✅ Production-ready code
