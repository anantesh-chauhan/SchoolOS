/**
 * Test script for Parent User ID Generator
 */

const API_BASE_URL = 'http://localhost:5000';
let token = '';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_BASE_URL + endpoint, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function getAuthToken() {
  try {
    console.log('\n📝 Getting authentication token...');
    const response = await apiCall('/api/auth/login', 'POST', {
      email: 'admin@greenvalley.edu.in',
      password: 'admin123'
    });

    if (response.status !== 200) {
      throw new Error(response.data?.message || 'Login failed');
    }

    token = response.data.data.token;
    console.log('✅ Token obtained');
    return token;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }
}

async function test1_GenerateParentId() {
  try {
    console.log('\n📋 TEST 1: Generate Parent ID for student with serial');
    console.log('Student ID: cmojjcvdf00011gaz238j4g36');

    const response = await apiCall('/api/students/generate-parent-id', 'POST', {
      studentId: 'cmojjcvdf00011gaz238j4g36'
    });

    if (response.status === 200 && response.data.success) {
      console.log('✅ SUCCESS');
      console.log('Parent User ID:', response.data.data.parentUserId);
      console.log('Father Name:', response.data.data.fatherName);
      console.log('Student Name:', response.data.data.studentFirstName);
      console.log('Class:', response.data.data.className);
      console.log('Serial No:', response.data.data.serialNo);
      console.log('Session:', response.data.data.session);
      return response.data;
    } else {
      console.error('❌ FAILED');
      console.error('Error:', response.data?.message);
    }
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Error:', error.message);
  }
}

async function test2_DuplicateGeneration() {
  try {
    console.log('\n📋 TEST 2: Duplicate prevention (try generating again)');
    console.log('Student ID: cmojjcvdf00011gaz238j4g36');

    const response = await apiCall('/api/students/generate-parent-id', 'POST', {
      studentId: 'cmojjcvdf00011gaz238j4g36'
    });

    if (response.status === 400 && response.data?.message === 'Parent user ID already generated') {
      console.log('✅ CORRECT: Duplicate prevented');
      console.log('Existing ID:', response.data?.data?.parentUserId);
      return;
    }
    console.error('❌ FAILED');
    console.error('Error:', response.data?.message);
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Error:', error.message);
  }
}

async function test3_SequentialGeneration() {
  try {
    console.log('\n📋 TEST 3: Sequential generation (generate for multiple students)');
    
    // Find students without parent user ID in Class 11
    const studentsResponse = await apiCall('/api/students?className=Class%2011&limit=5');
    const students = studentsResponse.data.data.data;
    
    const results = [];
    for (const student of students) {
      if (!student.parentUserId && student.serialNo) {
        try {
          const response = await apiCall('/api/students/generate-parent-id', 'POST', {
            studentId: student.id
          });
          if (response.status === 200) {
            results.push({
              studentId: student.id,
              parentUserId: response.data.data.parentUserId,
              serialNo: response.data.data.serialNo,
              fatherName: response.data.data.fatherName,
              studentFirstName: response.data.data.studentFirstName
            });
          }
        } catch (err) {
          // Skip if error
        }
      }
    }

    console.log('✅ Generated Parent IDs for', results.length, 'students');
    results.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.parentUserId} (Serial: ${r.serialNo})`);
    });
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Error:', error.message);
  }
}

async function test4_MissingSerial() {
  try {
    console.log('\n📋 TEST 4: Missing serial requirement');
    
    // Find a student without serial number
    const studentsResponse = await apiCall('/api/students?limit=100');
    const studentWithoutSerial = studentsResponse.data.data.data.find(s => !s.serialNo);

    if (!studentWithoutSerial) {
      console.log('⚠️ SKIPPED: No students without serial found');
      return;
    }

    const response = await apiCall('/api/students/generate-parent-id', 'POST', {
      studentId: studentWithoutSerial.id
    });

    if (response.status === 400 && response.data?.message === 'Student serial number must be generated first') {
      console.log('✅ CORRECT: Serial requirement enforced');
      return;
    }
    console.error('❌ FAILED');
    console.error('Error:', response.data?.message);
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Error:', error.message);
  }
}

async function test5_InvalidStudent() {
  try {
    console.log('\n📋 TEST 5: Invalid student ID');

    const response = await apiCall('/api/students/generate-parent-id', 'POST', {
      studentId: 'invalid-student-id-xyz'
    });

    if (response.status === 404 && response.data?.message === 'Student not found') {
      console.log('✅ CORRECT: Student not found error');
      return;
    }
    console.error('❌ FAILED');
    console.error('Error:', response.data?.message);
  } catch (error) {
    console.error('❌ FAILED');
    console.error('Error:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Parent User ID Generator Tests\n');
  console.log('='.repeat(50));

  try {
    await getAuthToken();
    await test1_GenerateParentId();
    await test2_DuplicateGeneration();
    await test3_SequentialGeneration();
    await test4_MissingSerial();
    await test5_InvalidStudent();

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

runTests();
