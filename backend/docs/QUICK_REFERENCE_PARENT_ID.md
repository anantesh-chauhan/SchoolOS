# 📋 Parent User ID Generator - Quick Reference

## 🚀 Quick Start

### Generate Parent User ID

```bash
curl -X POST http://localhost:5000/api/students/generate-parent-id \
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

---

## 📌 Format

```
father.student.c{class}.{serial}.{year}@{schoolCode}.schoolos.edu
```

| Part | Rule | Example |
|------|------|---------|
| father | lowercase, no spaces | "Suresh Kumar" → "sureshkumar" |
| student | lowercase, no spaces | "Rajesh" → "rajesh" |
| c{class} | class number/name, lowercase | "Class 5" → "c5" |
| {serial} | serial number (no prefix) | 1 → "1", 112 → "112" |
| {year} | last 2 digits of first year | "2026-27" → "26" |
| {schoolCode} | lowercase code | "GVS001" → "gvs001" |
| .schoolos.edu | static domain | Always ".schoolos.edu" |

---

## ✅ Prerequisites

Before generating parent user ID, ensure:

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
  "fatherName": "Suresh Kumar",
  "parentMobile": "9876543210",
  "session": "2026-27"
}
```

### Step 2: Generate Serial
```bash
POST /api/students/generate-serial
Body: { "studentId": "..." }
```

### Step 3: Generate Parent ID
```bash
POST /api/students/generate-parent-id
Body: { "studentId": "..." }
```

---

## 📊 Examples

| Input | Output |
|-------|--------|
| Mohan Singh, Rahul, Class 9, S112, 2026-27, DPS | `mohansingh.rahul.c9.112.26@dps.schoolos.edu` |
| Suresh Kumar, Rajesh, Class 5, S1, 2026-27, GVS001 | `sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu` |
| Patel, Priya, LKG, S5, 2025-26, ABC | `patel.priya.clkg.5.25@abc.schoolos.edu` |

---

## ⚠️ Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 200 | ✅ Parent ID generated | Use returned parentUserId |
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
✅ **Multi-component format** (father, student, class, serial visible)
✅ **Auto-formatted** (consistent across school)
✅ **School-scoped** (isolated by schoolCode)
✅ **Authentication required** (secure)
✅ **Pre-requisite check** (serial must exist first)

---

## 💡 Pro Tips

1. **Generate in Order**:
   - Create → Serial → Parent ID (in this order)

2. **Batch Operations**:
   - Generate serials for all students, then parent IDs

3. **Error Handling**:
   - Always check response status
   - Handle "serial not generated" gracefully

4. **Name Handling**:
   - Multi-word names are combined: "Suresh Kumar" → "sureshkumar"
   - All spaces removed, converted to lowercase

5. **Format Consistency**:
   - Same format for all parents in same school
   - Easy to recognize and parse

6. **Key Difference from Student ID**:
   - Serial has no prefix (1 instead of S1)
   - Includes both father and student names
   - Everything is lowercase (no uppercase C or S)

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
→ Check fatherName is correctly spelled
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
- Service: `src/services/parentUserId.service.js`
- Routes: `src/routes/students.js`

**Documentation**:
- Full docs: `docs/PARENT_USER_ID_GENERATOR.md`
- This file: `docs/QUICK_REFERENCE_PARENT_ID.md`
- Main README: `PARENT_USER_ID_README.md`

---

## 📞 Service Functions

```javascript
import * as parentUserIdService from './services/parentUserId.service.js';

// Generate parent user ID
await parentUserIdService.generateParentUserId(studentId, schoolId);

// Check if has parent user ID
await parentUserIdService.hasParentUserId(studentId);

// Get parent user ID
await parentUserIdService.getParentUserId(studentId);

// Validate format
parentUserIdService.isValidParentUserIdFormat('sureshkumar.rajesh.c5.1.26@gvs001.schoolos.edu');

// Extract components (for reference)
parentUserIdService.extractClassNumber('Class 5'); // "5"
parentUserIdService.extractSessionYear('2026-27'); // "26"
```

---

## 🎯 Summary

**Endpoint**: `POST /api/students/generate-parent-id`  
**Requires**: Student ID + Serial Number  
**Returns**: Formatted parent user ID  
**Format**: `father.student.c{class}.{serial}.{year}@{code}.schoolos.edu`  
**Status**: ✅ Production Ready

---

## 🔄 Comparison with Student ID

**Student ID**: `firstname.C{class}.S{serial}.{year}@{code}.schoolos.edu`  
- Uppercase C and S
- Serial with "S" prefix

**Parent ID**: `father.student.c{class}.{serial}.{year}@{code}.schoolos.edu`  
- All lowercase
- Serial without prefix
- Includes both names

---

**Need more help?** Check the full documentation in [PARENT_USER_ID_GENERATOR.md](PARENT_USER_ID_GENERATOR.md)
