# 📋 Serial Number Generator - Quick Reference

## 🚀 Quick Start

### Generate a Serial Number

```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
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
    "serialNo": 1,
    "className": "Class 5",
    "session": "2026-27"
  }
}
```

---

## 📌 Key Points

| Property | Details |
|----------|---------|
| **Endpoint** | `POST /api/students/generate-serial` |
| **Auth** | Bearer Token (required) |
| **Input** | `{ "studentId": "..." }` |
| **Output** | Student ID, Serial No, Class, Session |
| **Serial Start** | 1 |
| **Increment** | +1 per student |
| **Scope** | Per className + session |
| **Unique Per** | schoolId + className + session |

---

## ✅ Workflow

1. **Create Student**
   ```
   POST /api/students
   ```

2. **Get Student ID**
   ```
   From create response or GET /api/students
   ```

3. **Generate Serial**
   ```
   POST /api/students/generate-serial
   ```

4. **Verify Serial**
   ```
   GET /api/students/:id
   ```

---

## 🎯 Examples

### Multiple Students in Same Class
```
Student 1 (Class 5, 2026-27) → serialNo = 1
Student 2 (Class 5, 2026-27) → serialNo = 2
Student 3 (Class 5, 2026-27) → serialNo = 3
```

### Different Classes Reset Count
```
Student A (Class 5, 2026-27) → serialNo = 1
Student B (Class 6, 2026-27) → serialNo = 1 ← Resets!
```

### Different Sessions Reset Count
```
Student C (Class 5, 2026-27) → serialNo = 1
Student D (Class 5, 2025-26) → serialNo = 1 ← Resets!
```

---

## ⚠️ Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 200 | ✅ Serial generated successfully | Use the returned serialNo |
| 400 | Serial already generated | Don't regenerate - serial exists |
| 400 | Invalid studentId | Provide valid string studentId |
| 401 | Invalid token | Get new auth token |
| 403 | Unauthorized | Student from different school |
| 404 | Student not found | Check studentId |
| 500 | Server error | Check server logs |

---

## 🔑 Authorization

```
Header: Authorization: Bearer YOUR_AUTH_TOKEN
```

Get token:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"password"}'
```

---

## 📊 Service Functions

Use in your code:

```javascript
import * as serial from './services/serial.service.js';

// Generate serial
await serial.generateSerialForStudent(studentId, schoolId);

// Get next serial (without generating)
await serial.getNextSerialNumber(className, session, schoolId);

// List students with serials
await serial.getStudentsByClassAndSession(className, session, schoolId);

// Check if has serial
await serial.hasSerialNumber(studentId);

// Get statistics
await serial.getSerialStatistics(className, session, schoolId);
```

---

## 🧪 Testing

Run all scenarios:

See `SERIAL_NUMBER_TESTING.md` for:
- Scenario 1: First student (→ serialNo = 1)
- Scenario 2: Multiple students (→ 1, 2, 3, ...)
- Scenario 3: Different classes (→ independent sequences)
- Scenario 4: Duplicate prevention (→ error response)
- Scenario 5: Session isolation (→ resets per session)
- Scenario 6: Error handling (→ various errors)

---

## 📁 Files

**Implementation**:
- Controller: `src/controllers/student.controller.js`
- Routes: `src/routes/students.js`
- Service: `src/services/serial.service.js`

**Documentation**:
- Overview: `docs/serial-number-module.md`
- Testing: `docs/SERIAL_NUMBER_TESTING.md`
- Summary: `SERIAL_NUMBER_README.md`
- This file: `docs/QUICK_REFERENCE.md`

---

## ✨ Features

✅ Sequential generation (1, 2, 3...)
✅ Unique per class-session
✅ School isolation
✅ Prevents duplicates (idempotent)
✅ Full authorization
✅ Comprehensive error handling
✅ Optimized database queries
✅ Production ready

---

## 🔗 Related Endpoints

```
GET  /api/students              - List all students
GET  /api/students/:id          - Get specific student with serialNo
POST /api/students              - Create new student (serialNo = null)
PUT  /api/students/:id          - Update student
DELETE /api/students/:id        - Delete student
POST /api/students/generate-serial  - Generate serialNo ← NEW!
```

---

## 💡 Tips

1. Always check for "Serial already generated" errors
2. Generate serials only after confirming student details
3. Serials reset for each class and session combination
4. Test with different classes to see the reset behavior
5. Use the service functions for programmatic access

---

## 🆘 Troubleshooting

**Serial not incrementing?**
- Check that students are in SAME class AND SAME session
- Verify previous students have serialNo values (not null)

**Getting duplicate error unexpectedly?**
- Call GET /api/students/:id to check current serialNo

**Authorization failed?**
- Verify token is valid and not expired
- Check that student belongs to your school

---

## 📞 Quick Commands

### List students
```bash
curl http://localhost:5000/api/students \
  -H "Authorization: Bearer TOKEN"
```

### Get one student
```bash
curl http://localhost:5000/api/students/STUDENT_ID \
  -H "Authorization: Bearer TOKEN"
```

### Create student
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName":"John",
    "dob":"2010-05-15",
    "gender":"Male",
    "className":"Class 5",
    "fatherName":"James",
    "parentMobile":"9876543210",
    "session":"2026-27"
  }'
```

### Generate serial
```bash
curl -X POST http://localhost:5000/api/students/generate-serial \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"STUDENT_ID"}'
```

---

**Need more help?** Check the full documentation files listed above.
