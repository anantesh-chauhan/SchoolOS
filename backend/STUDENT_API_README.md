# Student Management API - Backend Implementation

## Summary

The backend API for student management has been fully implemented with the following components:

### 1. **Prisma Student Model** (`backend/prisma/schema.prisma`)

```prisma
model Student {
  id                String    @id @default(cuid())
  schoolId          String
  
  // Student Information
  studentFirstName  String
  studentLastName   String?
  dob               DateTime
  gender            String
  className         String
  admissionDate     DateTime?
  
  // Parent Information
  fatherName        String
  motherName        String?
  parentMobile      String
  alternateMobile   String?
  address           String?
  
  // Academic Info
  session           String
  
  // System Fields
  serialNo          Int?
  studentUserId     String?
  parentUserId      String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  school            School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
}
```

### 2. **Student Controller** (`backend/src/controllers/student.controller.js`)

Implements the following functions:

- **`createStudent(req, res)`** - Create a new student
  - Validates required fields
  - Returns 400 if required fields missing
  - Returns 201 on success with created student object
  
- **`getStudents(req, res)`** - Get all students (paginated)
  - Query params: `page`, `limit`, `session`
  - Returns paginated results

- **`getStudentById(req, res)`** - Get a specific student
  - Returns 404 if not found
  - Checks authorization (school ownership)

- **`updateStudent(req, res)`** - Update a student
  - Validates data
  - Returns 403 if unauthorized

- **`deleteStudent(req, res)`** - Delete a student
  - Checks authorization

### 3. **Student Routes** (`backend/src/routes/students.js`)

```javascript
POST   /api/students          - Create student
GET    /api/students          - Get all students (paginated)
GET    /api/students/:id      - Get specific student
PUT    /api/students/:id      - Update student
DELETE /api/students/:id      - Delete student
```

### 4. **Server Integration** (`backend/server.js`)

Routes registered at `/api/students` with authentication middleware applied.

---

## Validation Rules

**Required Fields for Student Creation:**

```javascript
- studentFirstName (must not be empty)
- dob (date of birth)
- gender
- className
- fatherName
- parentMobile (must be valid phone format: 7-15 digits)
- session
```

**Validation Error Response (400):**

```json
{
  "success": false,
  "message": "Required fields missing",
  "errors": {
    "studentFirstName": "Student first name is required",
    "dob": "Date of birth is required",
    ...
  }
}
```

---

## API Endpoints

### 1. Create Student

**POST** `/api/students`

**Request Body:**

```json
{
  "studentFirstName": "John",
  "studentLastName": "Doe",
  "dob": "2010-05-15",
  "gender": "Male",
  "className": "Class 10",
  "admissionDate": "2024-04-29",
  "fatherName": "James Doe",
  "motherName": "Jane Doe",
  "parentMobile": "+1234567890",
  "alternateMobile": "+0987654321",
  "address": "123 Main St, City",
  "session": "2026-27"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "id": "cuid123...",
    "schoolId": "school123...",
    "studentFirstName": "John",
    "studentLastName": "Doe",
    "dob": "2010-05-15T00:00:00.000Z",
    "gender": "Male",
    "className": "Class 10",
    "admissionDate": "2024-04-29T00:00:00.000Z",
    "fatherName": "James Doe",
    "motherName": "Jane Doe",
    "parentMobile": "+1234567890",
    "alternateMobile": "+0987654321",
    "address": "123 Main St, City",
    "session": "2026-27",
    "serialNo": null,
    "studentUserId": null,
    "parentUserId": null,
    "createdAt": "2026-04-29T12:00:00.000Z",
    "updatedAt": "2026-04-29T12:00:00.000Z",
    "school": {
      "id": "school123...",
      "schoolName": "My School",
      "schoolCode": "SCH001"
    }
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "Required fields missing",
  "errors": {
    "parentMobile": "Parent mobile must be a valid phone number"
  }
}
```

### 2. Get All Students

**GET** `/api/students?page=1&limit=10&session=2026-27`

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid123...",
      "studentFirstName": "John",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

### 3. Get Student by ID

**GET** `/api/students/:id`

**Success Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

### 4. Update Student

**PUT** `/api/students/:id`

**Request Body:** (any of the student fields)

```json
{
  "studentFirstName": "Jonathan",
  "session": "2027-28"
}
```

### 5. Delete Student

**DELETE** `/api/students/:id`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Student deleted successfully"
}
```

---

## Database Setup

### Run Migrations

```bash
# Navigate to backend directory
cd backend

# Create and apply migrations
npx prisma migrate dev --name add_student_model

# Or if using manual migration
npx prisma db push
```

### If Migration Issues

If you encounter migration issues due to the pre-existing `20260427_academic_structure_module` migration, you can:

1. **Option A: Fix the existing migration** - Remove `IF NOT EXISTS` clauses from ALTER TABLE constraints
2. **Option B: Reset the database** (development only)
   ```bash
   npx prisma migrate reset --force
   ```
3. **Option C: Apply manually**
   ```bash
   npx prisma db execute --stdin < prisma/migrations/20260429_add_student_model/migration.sql
   ```

---

## Frontend Integration

The StudentForm component from the frontend (`frontend/src/components/StudentForm.jsx`) sends data to this API:

```javascript
const StudentForm = ({ onSave }) => {
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Student saved');
        if (typeof onSave === 'function') onSave(result.data);
      }
    } catch (err) {
      toast.error('Failed to save');
    }
  };
};
```

---

## Authentication

All endpoints require authentication via `authMiddleware`. The middleware:
- Verifies JWT tokens
- Extracts `schoolId` from the authenticated user
- Prevents cross-school data access

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Technical error details (dev only)"
}
```

HTTP Status Codes:
- **201** - Created successfully
- **200** - OK / Success
- **400** - Bad Request (validation error)
- **403** - Forbidden (unauthorized)
- **404** - Not Found
- **500** - Internal Server Error

---

## Testing with cURL

```bash
# Create a student
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "studentFirstName": "John",
    "dob": "2010-05-15",
    "gender": "Male",
    "className": "Class 10",
    "fatherName": "James",
    "parentMobile": "+1234567890",
    "session": "2026-27"
  }'

# Get all students
curl -X GET http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get specific student
curl -X GET http://localhost:5000/api/students/cuid123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Files Modified/Created

1. ✅ `backend/prisma/schema.prisma` - Added Student model and School.students relation
2. ✅ `backend/src/controllers/student.controller.js` - Complete CRUD controller
3. ✅ `backend/src/routes/students.js` - Express routes
4. ✅ `backend/server.js` - Registered routes
5. ✅ `backend/prisma/migrations/20260429_add_student_model/migration.sql` - Database migration

---

## Next Steps

1. **Run database migration** to create the Student table
2. **Test API endpoints** with Postman or cURL
3. **Connect frontend** StudentForm to the API
4. **Add serial number generation** (if needed in future)
5. **Add user ID generation** for students and parents (if needed in future)

---

## Notes

- `serialNo`, `studentUserId`, and `parentUserId` are currently NULL as per requirements
- These can be populated later when serial number generation and user account creation features are implemented
- All timestamps use UTC (Prisma default)
- Data is cascaded on school deletion (soft delete not implemented yet)

