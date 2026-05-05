# Student & Parent Login Guide

## Overview

The SchoolOS application now supports dedicated login endpoints for students and parents using the credentials generated through the admin panel.

## Login Endpoints

### 1. Student Login
- **Endpoint**: `POST /auth/login-student`
- **URL**: `/student-login` (Frontend page)
- **Body Parameters**:
  ```json
  {
    "email": "studentUserId",
    "password": "studentPassword"
  }
  ```
- **Example**:
  ```json
  {
    "email": "john.C5.S1.26@school.schoolos.edu",
    "password": "john@1@26"
  }
  ```

### 2. Parent Login
- **Endpoint**: `POST /auth/login-parent`
- **URL**: `/parent-login` (Frontend page)
- **Body Parameters**:
  ```json
  {
    "email": "parentUserId",
    "password": "parentPassword"
  }
  ```
- **Example**:
  ```json
  {
    "email": "rajesh.john.c5.1.26@school.schoolos.edu",
    "password": "rajesh#1#15"
  }
  ```

## How to Generate Credentials

1. **Admin Panel**: Navigate to "Add Student" page
2. **Fill Student Information**: Complete all required fields
3. **Save Student**: Click "Save Student" button
4. **Generate Credentials**: Click "Generate Credentials" button
5. **View & Copy**: A modal will show all generated credentials

## Credentials Modal Features

The credentials modal displays:
- ✅ Serial Number
- ✅ Student User ID (email format)
- ✅ Student Password
- ✅ Parent User ID (email format)
- ✅ Parent Password
- ✅ Copy-to-clipboard buttons for each field
- ✅ PDF download option
- ⚠️ Security warning (passwords shown only once)

## Password Format

### Student Password Format
```
{firstName}@{serialNo}@{YY}
```
**Example**: `john@1@26`
- FirstName: john
- Serial: 1
- Year (last 2 digits): 26

### Parent Password Format
```
{FatherName}#{serialNo}#{dobDay}
```
**Example**: `rajesh#1#15`
- Father Name: rajesh
- Serial: 1
- Day of Birth: 15 (two digits with leading zero if needed)

## Login Flow

```
1. Visit /student-login or /parent-login page
2. Select "Student" or "Parent" tab
3. Enter email (studentUserId or parentUserId)
4. Enter password (generated credentials)
5. Click "Login"
6. Redirected to appropriate dashboard
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid email or password | Wrong credentials | Check credentials from modal |
| Password not configured | Student/Parent not created | Generate credentials first |
| Email not found | Wrong user ID | Use exact studentUserId/parentUserId |

## API Examples

### Login Student (cURL)
```bash
curl -X POST http://localhost:5000/api/auth/login-student \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.C5.S1.26@school.schoolos.edu",
    "password": "john@1@26"
  }'
```

### Login Parent (cURL)
```bash
curl -X POST http://localhost:5000/api/auth/login-parent \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rajesh.john.c5.1.26@school.schoolos.edu",
    "password": "rajesh#1#15"
  }'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "student_id",
      "email": "john.C5.S1.26@school.schoolos.edu",
      "name": "John",
      "role": "STUDENT",
      "schoolId": "school_id",
      "studentId": "student_id",
      "school": {
        "id": "school_id",
        "schoolName": "My School",
        "schoolCode": "MS001"
      }
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

## Security Notes

⚠️ **Important Security Considerations**:
1. Passwords are shown **only once** after generation
2. Passwords are hashed in the database using bcrypt
3. Always share credentials securely with students/parents
4. Never share credentials via unsecured channels
5. Advise users to change passwords after first login (future enhancement)

## Frontend Service Methods

```javascript
import { authService } from './services/authService';

// Login as Student
const { token, user } = await authService.loginStudent(studentUserId, password);

// Login as Parent
const { token, user } = await authService.loginParent(parentUserId, password);

// Get current user
const user = authService.getCurrentUser();

// Check if authenticated
if (authService.isAuthenticated()) {
  // User is logged in
}

// Logout
await authService.logout();
```

## Backend Service Methods

```javascript
import * as passwordService from './services/password.service';

// Generate passwords for a student
const result = await passwordService.generatePasswordsForStudent(
  studentId,
  schoolId,
  false // forceRegenerate
);

// Verify password
const isValid = await passwordService.verifyPassword(plainPassword, hash);
```

## Testing

### Test Scenario
1. Create a student in admin panel
2. Generate credentials
3. Copy the Student User ID and Password
4. Visit `/student-login` page
5. Enter credentials and login
6. Verify redirect to student dashboard

## Troubleshooting

### "Invalid email or password"
- Check if credentials are copied correctly (no extra spaces)
- Verify studentUserId matches exactly (case-sensitive)
- Ensure password is correct (special characters: @, #)

### "Password not configured"
- Student/Parent password not generated
- Click "Generate Credentials" button in admin panel

### "Email not found"
- Using wrong studentUserId or parentUserId
- Check the credentials modal for exact email format

## Files Modified

- ✅ `backend/src/controllers/auth.controller.js` - Added loginStudent & loginParent
- ✅ `backend/src/routes/auth.js` - Added new routes
- ✅ `frontend/src/services/authService.js` - Added login methods
- ✅ `frontend/src/pages/StudentLoginPage.jsx` - New login page
- ✅ `frontend/src/components/CredentialsModal.jsx` - Shows credentials
- ✅ `frontend/src/components/StudentForm.jsx` - Generate credentials button

## Next Steps

1. Add student/parent dashboard pages
2. Implement password change functionality
3. Add password reset flow
4. Add multi-factor authentication
5. Create credential distribution (email, SMS, etc.)
