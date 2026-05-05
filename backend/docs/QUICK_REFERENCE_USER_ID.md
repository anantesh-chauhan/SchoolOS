# 📋 Student User ID Generator - Quick Reference

## 🚀 Quick Start

### Generate Student User ID

```bash
curl -X POST http://localhost:5000/api/students/generate-student-id \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "STUDENT_ID_HERE"}'
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "studentId": "...",
    "studentUserId": "rajesh.C5.S1.26@gvs001.schoolos.edu",
    "studentFirstName": "Rajesh",
    "className": "Class 5",
    "serialNo": 1,
    "session": "2026-27",
    "schoolCode": "GVS001"
  }
}
```

---

## 📌 Format

```
firstname.C{class}.S{serial}.{year}@{schoolCode}.schoolos.edu
```

| Part | Rule | Example |
|------|------|---------|
| firstname | lowercase, no spaces | "Rajesh Kumar" → "rajeshkumar" |
| C{class} | class number/name | "Class 5" → "C5" |
| S{serial} | serial number | 1, 2, 3... → "S1", "S2", "S3" |
| {year} | last 2 digits of first year | "2026-27" → "26" |
| {schoolCode} | lowercase code | "GVS001" → "gvs001" |
| .schoolos.edu | static domain | Always ".schoolos.edu" |

---

## ✅ Prerequisites

Before generating user ID, ensure:

1. ✅ Student exists
2. ✅ Serial number already generated
3. ✅ User authenticated
4. ✅ Student belongs to your school

If serial not generated:
```
Error: "Student serial number must be generated first"
→ Run: POST /api/students/generate-serial first
```

---

## 🧪 Complete Workflow

### Step 1: Create Student
```bash
POST /api/students
Body: {
  "studentFirstName": "Rajesh",
  "dob": "2010-05-15",
  "gender": "Male",
  "className": "Class 5",
  "fatherName": "Suresh",
  "parentMobile": "9876543210",
  "session": "2026-27"
}
```

### Step 2: Generate Serial
```bash
POST /api/students/generate-serial
Body: { "studentId": "..." }
```

### Step 3: Generate User ID
```bash
POST /api/students/generate-student-id
Body: { "studentId": "..." }
```

---

## 📊 Examples

| Input | Output |
|-------|--------|
| Rahul, Class 9, S112, 2026-27, DPS | `rahul.C9.S112.26@dps.schoolos.edu` |
| Ananya Singh, Class 11, S1, 2026-27, GVS001 | `ananyasingh.C11.S1.26@gvs001.schoolos.edu` |
| Priya, LKG, S5, 2025-26, ABC | `priya.CLKG.S5.25@abc.schoolos.edu` |

---

## ⚠️ Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 200 | ✅ User ID generated | Use returned studentUserId |
| 400 | Serial not generated | Generate serial first |
| 400 | Already generated | Don't regenerate |
| 400 | Invalid studentId | Provide valid string |
| 401 | Invalid token | Get new auth token |
| 403 | Unauthorized | Student from different school |
| 404 | Student not found | Check studentId |
| 500 | Server error | Check server logs |

---

## 🔑 Authorization

```
Header: Authorization: Bearer YOUR_AUTH_TOKEN
```

Get token from:
```bash
POST /api/auth/login
Body: {"email":"...","password":"..."}
```

---

## ✨ Features

✅ **Unique per student** (never duplicated)
✅ **Encoded information** (class, serial, year visible in ID)
✅ **Auto-formatted** (consistent across school)
✅ **School-scoped** (isolated by schoolCode)
✅ **Authentication required** (secure)
✅ **Pre-requisite check** (serial must exist first)

---

## 💡 Pro Tips

1. **Generate in Order**:
   - Create → Serial → User ID (in this order)

2. **Batch Operations**:
   - Generate serials for all students, then user IDs

3. **Error Handling**:
   - Always check response status
   - Handle "serial not generated" gracefully

4. **Name Handling**:
   - Multi-word names are combined: "Ananya Singh" → "ananyasingh"
   - All spaces removed, converted to lowercase

5. **Format Consistency**:
   - Same format for all students in same school
   - Easy to recognize and parse

---

## 🆘 Troubleshooting

### "Serial not generated"
```
→ Run: POST /api/students/generate-serial first
```

### "Already generated"
```
→ ID exists: Don't regenerate
→ If needed to reset: Contact admin
```

### Wrong format generated
```
→ Check className format (e.g., "Class 5" not "class5")
→ Check schoolCode is correct
→ Check session format (e.g., "2026-27")
```

### Authorization failed
```
→ Verify token is valid
→ Check student belongs to your school
→ Request new token if expired
```

---

## 📁 Files

**Implementation**:
- Controller: `src/controllers/student.controller.js`
- Service: `src/services/studentUserId.service.js`
- Routes: `src/routes/students.js`

**Documentation**:
- Full docs: `docs/STUDENT_USER_ID_GENERATOR.md`
- This file: `docs/QUICK_REFERENCE_USER_ID.md`
- Main README: `STUDENT_USER_ID_README.md`

---

## 📞 Service Functions

```javascript
import * as userIdService from './services/studentUserId.service.js';

// Generate user ID
await userIdService.generateStudentUserId(studentId, schoolId);

// Check if has user ID
await userIdService.hasStudentUserId(studentId);

// Get user ID
await userIdService.getStudentUserId(studentId);

// Validate format
userIdService.isValidUserIdFormat('rajesh.C5.S1.26@gvs001.schoolos.edu');

// Extract components (for reference)
userIdService.extractClassNumber('Class 5'); // "5"
userIdService.extractSessionYear('2026-27'); // "26"
```

---

## 🎯 Summary

**Endpoint**: `POST /api/students/generate-student-id`  
**Requires**: Student ID + Serial Number  
**Returns**: Formatted user ID  
**Format**: `firstname.C{class}.S{serial}.{year}@{code}.schoolos.edu`  
**Status**: ✅ Production Ready

---

**Need more help?** Check the full documentation in [STUDENT_USER_ID_GENERATOR.md](STUDENT_USER_ID_GENERATOR.md)
