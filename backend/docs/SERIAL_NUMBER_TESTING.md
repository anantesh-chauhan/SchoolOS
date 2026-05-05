# Serial Number Generator - API Testing Guide

## Prerequisites

- Node.js backend running on http://localhost:5000
- Valid authentication token
- Student records in the database

## Base URL

```
http://localhost:5000/api
```

## Authentication

All endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

To get a token:
1. Login via POST /auth/login
2. Use the returned token in subsequent requests

## Test Scenarios

### Scenario 1: Generate Serial for First Student

**Objective**: Generate a serial number (should be 1) for the first student in a class

**Steps**:

1. **Create a Student**:
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Aisha",
    "dob": "2010-06-15",
    "gender": "Female",
    "className": "Class 7",
    "fatherName": "Ahmed Khan",
    "parentMobile": "9876543210",
    "session": "2026-27"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "id": "student_id_here",
    "serialNo": null,
    ...
  }
}
```

2. **Generate Serial Number**:
```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_id_here"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Serial number generated successfully",
  "data": {
    "studentId": "student_id_here",
    "serialNo": 1,
    "className": "Class 7",
    "session": "2026-27"
  }
}
```

---

### Scenario 2: Generate Serials for Multiple Students (Sequential)

**Objective**: Create 5 students and verify serials increment from 1 to 5

**Steps**:

1. **Create 5 Students** (repeat for each):
```bash
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/students \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"studentFirstName\": \"Student$i\",
      \"dob\": \"2010-06-15\",
      \"gender\": \"Male\",
      \"className\": \"Class 7\",
      \"fatherName\": \"Father$i\",
      \"parentMobile\": \"9876543210\",
      \"session\": \"2026-27\"
    }"
done
```

2. **Generate Serials** (for each student ID):
```bash
# Student 1
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_1_id"}'
# Expected: serialNo = 1

# Student 2
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_2_id"}'
# Expected: serialNo = 2

# ... and so on
```

**Verification**:
```bash
curl -X GET "http://localhost:5000/api/students?className=Class%207&session=2026-27" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: All 5 students with serialNo: 1, 2, 3, 4, 5

---

### Scenario 3: Verify Serials are Unique per Class

**Objective**: Create students in different classes and verify each gets serialNo = 1

**Steps**:

1. **Create Student in Class 5**:
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Class5Student",
    "dob": "2010-06-15",
    "gender": "Male",
    "className": "Class 5",
    "fatherName": "Father",
    "parentMobile": "9876543210",
    "session": "2026-27"
  }'
```
Note the returned `id`

2. **Create Student in Class 6**:
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Class6Student",
    "dob": "2010-06-15",
    "gender": "Female",
    "className": "Class 6",
    "fatherName": "Father",
    "parentMobile": "9876543210",
    "session": "2026-27"
  }'
```
Note the returned `id`

3. **Generate Serials**:
```bash
# Class 5 student
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "class5_student_id"}'
# Expected: serialNo = 1

# Class 6 student
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "class6_student_id"}'
# Expected: serialNo = 1 (resets for different class)
```

**Verification**: Both students have serialNo = 1 despite being in different classes

---

### Scenario 4: Prevent Duplicate Serial Generation

**Objective**: Verify that attempting to generate a serial twice returns an error

**Steps**:

1. **Generate Serial** (first time - should succeed):
```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_id"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Serial number generated successfully",
  "data": {
    "studentId": "student_id",
    "serialNo": 5,
    ...
  }
}
```

2. **Generate Serial Again** (should fail):
```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_id"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "message": "Serial already generated",
  "data": {
    "studentId": "student_id",
    "serialNo": 5
  }
}
```

---

### Scenario 5: Verify Session Isolation

**Objective**: Verify that serials reset when session changes

**Steps**:

1. **Create Student in Session 2026-27**:
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Session2026",
    "dob": "2010-06-15",
    "gender": "Male",
    "className": "Class 8",
    "fatherName": "Father",
    "parentMobile": "9876543210",
    "session": "2026-27"
  }'
```

2. **Create Student in Session 2025-26** (same class):
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Session2025",
    "dob": "2010-06-15",
    "gender": "Female",
    "className": "Class 8",
    "fatherName": "Father",
    "parentMobile": "9876543210",
    "session": "2025-26"
  }'
```

3. **Generate Serials** (both should get 1):
```bash
# 2026-27 student
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "session2026_id"}'
# Expected: serialNo = 1

# 2025-26 student
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "session2025_id"}'
# Expected: serialNo = 1
```

**Verification**: Both have serialNo = 1 despite being in the same class (different sessions)

---

### Scenario 6: Error Handling

#### 6a. Invalid Student ID

```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "invalid_id"}'
```

**Expected Response** (404 Not Found):
```json
{
  "success": false,
  "message": "Student not found"
}
```

#### 6b. Missing Student ID

```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "message": "Student ID is required and must be a string"
}
```

#### 6c. Unauthorized Access

```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student_id"}'
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

## Using Postman

### 1. Create Environment

- Variable: `BASE_URL` = `http://localhost:5000`
- Variable: `TOKEN` = (your auth token)

### 2. Create Request

**Method**: POST
**URL**: `{{BASE_URL}}/api/students/generate-serial`

**Headers**:
```
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "studentId": "YOUR_STUDENT_ID"
}
```

### 3. Send Request

Click "Send" and check the response

---

## Using JavaScript/Fetch

```javascript
const token = 'YOUR_AUTH_TOKEN';
const studentId = 'YOUR_STUDENT_ID';

const response = await fetch('http://localhost:5000/api/students/generate-serial', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ studentId })
});

const data = await response.json();
console.log(data);
```

---

## Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Serial generated successfully | `{"success": true, "message": "Serial number generated successfully"}` |
| 400 | Bad request (already generated, invalid input) | `{"success": false, "message": "Serial already generated"}` |
| 401 | Unauthorized (invalid token) | `{"success": false, "message": "Invalid or expired token"}` |
| 403 | Forbidden (student belongs to different school) | `{"success": false, "message": "Unauthorized"}` |
| 404 | Student not found | `{"success": false, "message": "Student not found"}` |
| 500 | Server error | `{"success": false, "message": "Failed to generate serial number"}` |

---

## Performance Tips

1. **Batch Operations**: When creating multiple students, generate serials immediately after to avoid race conditions

2. **Database Indexing**: The Student table has indexes on:
   - `schoolId`
   - `session`
   - This ensures fast lookups for serial generation

3. **Caching**: For read-only operations, cache the next serial number temporarily

---

## Troubleshooting

### Serial not incrementing correctly?
- Check that students are in the SAME class and SAME session
- Verify that previous students have serialNo values (not null)

### Getting "Serial already generated" unexpectedly?
- The student might already have a serial
- Call GET /api/students/:id to verify the current serialNo

### Performance issues?
- Check database query performance
- Verify indexes are created correctly
- Consider archiving old sessions

---

## Cleanup/Reset Testing

To reset all serials for testing:

```bash
# Warning: This removes all serial numbers!
curl -X PUT http://localhost:5000/api/admin/students/reset-serials \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

*Note: This endpoint needs to be implemented separately*

---

## Next Steps

1. Run through all scenarios
2. Verify serial increment logic
3. Test error cases
4. Verify authorization checks
5. Monitor database performance
6. Document any issues found
