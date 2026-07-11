export const DEFAULT_SECTION_NAMES = ['A', 'B'];

export const CBSE_CLASS_CATALOG = [
  { className: 'Nursery', classOrder: 1, subjects: ['English', 'Hindi', 'Mathematics', 'Environmental Awareness', 'Rhymes', 'Art & Craft', 'General Activities'] },
  { className: 'LKG', classOrder: 2, subjects: ['English', 'Hindi', 'Mathematics', 'Environmental Awareness', 'Rhymes', 'Art & Craft', 'General Activities'] },
  { className: 'UKG', classOrder: 3, subjects: ['English', 'Hindi', 'Mathematics', 'Environmental Awareness', 'Rhymes', 'Art & Craft', 'General Activities'] },
  ...Array.from({ length: 5 }, (_, index) => ({
    className: `Class ${index + 1}`,
    classOrder: index + 4,
    subjects: ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'Computer', 'General Knowledge', 'Art & Craft', 'Moral Science'],
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    className: `Class ${index + 6}`,
    classOrder: index + 9,
    subjects: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'Sanskrit', 'General Knowledge', 'Moral Science'],
  })),
  ...Array.from({ length: 2 }, (_, index) => ({
    className: `Class ${index + 9}`,
    classOrder: index + 12,
    subjects: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer Applications', 'Physical Education'],
  })),
];

export const SENIOR_STREAMS = [
  {
    code: 'SCI',
    name: 'Science',
    sectionPrefix: 'SCI',
    subjects: ['English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Physical Education'],
  },
  {
    code: 'COM',
    name: 'Commerce',
    sectionPrefix: 'COM',
    subjects: ['English', 'Accountancy', 'Business Studies', 'Economics', 'Applied Mathematics', 'Informatics Practices', 'Physical Education'],
  },
  {
    code: 'HUM',
    name: 'Humanities',
    sectionPrefix: 'HUM',
    subjects: ['English', 'History', 'Political Science', 'Geography', 'Economics', 'Psychology', 'Physical Education'],
  },
];

export const SENIOR_CLASS_CATALOG = [
  { className: 'Class 11', classOrder: 14 },
  { className: 'Class 12', classOrder: 15 },
];

export const SUBJECT_CODE_BY_NAME = {
  English: 'ENG',
  Hindi: 'HIN',
  Mathematics: 'MAT',
  'Environmental Awareness': 'EAW',
  'Environmental Studies': 'EVS',
  Rhymes: 'RHY',
  'Art & Craft': 'ARTC',
  'General Activities': 'GACT',
  Computer: 'COMP',
  'General Knowledge': 'GK',
  'Moral Science': 'MS',
  Science: 'SCI',
  'Social Science': 'SST',
  Sanskrit: 'SAN',
  'Computer Applications': 'CA',
  'Artificial Intelligence': 'AI',
  'Physical Education': 'PE',
  Physics: 'PHY',
  Chemistry: 'CHE',
  Biology: 'BIO',
  'Computer Science': 'CS',
  Accountancy: 'ACC',
  'Business Studies': 'BST',
  Economics: 'ECO',
  'Applied Mathematics': 'AMAT',
  'Informatics Practices': 'IP',
  History: 'HIS',
  'Political Science': 'POL',
  Geography: 'GEO',
  Psychology: 'PSY',
  Sociology: 'SOC',
};

const PRE_PRIMARY_CHAPTERS = {
  English: ['Alphabet Sounds', 'Picture Words', 'Rhymes and Actions', 'Story Time'],
  Hindi: ['Swar Pehchan', 'Vyanjan Pehchan', 'Chitra Varnan', 'Bal Geet'],
  Mathematics: ['Numbers 1 to 20', 'Shapes and Colours', 'Big and Small', 'Patterns'],
  'Environmental Awareness': ['My Family', 'My School', 'Animals Around Us', 'Good Habits'],
  Rhymes: ['Action Rhymes', 'Number Rhymes', 'Festival Rhymes'],
  'Art & Craft': ['Colouring Fun', 'Paper Folding', 'Clay Play'],
  'General Activities': ['Circle Time', 'Sensorial Play', 'Festival Activities'],
};

const PRIMARY_CHAPTERS = {
  English: ['Reading Comprehension', 'Nouns and Pronouns', 'Verbs in Action', 'Picture Composition', 'Poems and Recitation'],
  Hindi: ['Bhasha Abhyas', 'Kavita Path', 'Varn Vichar', 'Kahani Path', 'Lekhan Abhyas'],
  Mathematics: ['Numbers and Place Value', 'Addition and Subtraction', 'Multiplication and Division', 'Fractions', 'Measurement', 'Geometry Basics'],
  'Environmental Studies': ['My Family and Neighbourhood', 'Plants Around Us', 'Animals and Birds', 'Food and Health', 'Water and Shelter'],
  Computer: ['Parts of a Computer', 'Keyboard and Mouse', 'Paint Tools', 'Internet Safety'],
  'General Knowledge': ['India Our Country', 'Famous Personalities', 'Sports and Games', 'Current Awareness'],
  'Art & Craft': ['Lines and Patterns', 'Colour Wheel', 'Paper Craft', 'Festival Art'],
  'Moral Science': ['Good Manners', 'Honesty', 'Helping Others', 'Cleanliness'],
};

const MIDDLE_CHAPTERS = {
  English: ['Prose Selections', 'Poetry Appreciation', 'Tenses', 'Active and Passive Voice', 'Writing Skills'],
  Hindi: ['Gadya Path', 'Padya Path', 'Vyakaran', 'Patra Lekhan', 'Nibandh Lekhan'],
  Mathematics: ['Integers and Rational Numbers', 'Algebraic Expressions', 'Linear Equations', 'Geometry', 'Mensuration', 'Data Handling'],
  Science: ['Food and Nutrition', 'Materials and Changes', 'Motion and Measurement', 'Light and Shadows', 'Reproduction in Plants', 'Electricity and Circuits'],
  'Social Science': ['History: Early Societies', 'Geography: Earth and Environment', 'Civics: Government', 'Resources and Development', 'Maps and Globes'],
  Computer: ['Computer Networks', 'Spreadsheets', 'Programming Basics', 'Cyber Safety'],
  Sanskrit: ['Sanskrit Varnamala', 'Shabd Roop', 'Dhatu Roop', 'Subhashitani'],
  'General Knowledge': ['Indian Constitution Basics', 'Science Around Us', 'World Geography', 'Awards and Honours'],
  'Moral Science': ['Respect and Responsibility', 'Discipline', 'Empathy', 'Digital Etiquette'],
};

const SECONDARY_CHAPTERS = {
  English: ['A Letter to God', 'Nelson Mandela', 'Two Stories about Flying', 'From the Diary of Anne Frank', 'Writing and Grammar'],
  Hindi: ['Kshitij Gadya', 'Kshitij Padya', 'Kritika Path', 'Vyakaran', 'Rachnatmak Lekhan'],
  Mathematics: ['Real Numbers', 'Polynomials', 'Pair of Linear Equations in Two Variables', 'Quadratic Equations', 'Arithmetic Progressions', 'Triangles', 'Coordinate Geometry', 'Introduction to Trigonometry', 'Some Applications of Trigonometry', 'Circles', 'Areas Related to Circles', 'Surface Areas and Volumes', 'Statistics', 'Probability'],
  Science: ['Chemical Reactions and Equations', 'Acids, Bases and Salts', 'Metals and Non-metals', 'Carbon and its Compounds', 'Life Processes', 'Control and Coordination', 'How do Organisms Reproduce?', 'Heredity', 'Light - Reflection and Refraction', 'The Human Eye and the Colourful World', 'Electricity', 'Magnetic Effects of Electric Current', 'Our Environment'],
  'Social Science': ['India Size and Location', 'French Revolution', 'Democracy in the Contemporary World', 'Poverty as a Challenge', 'Resources and Development'],
  'Computer Applications': ['Internet Basics', 'HTML and CSS', 'Cyber Ethics', 'Office Tools', 'Introduction to Python'],
  'Physical Education': ['Physical Fitness', 'Yoga', 'Team Games', 'Health and Nutrition'],
};

export const OFFICIAL_RESOURCE_LINKS = {
  ncertTextbooks: 'https://ncert.nic.in/textbook.php?ln=en',
  cbseCurriculum: 'https://cbseacademic.nic.in/curriculum_2027.html',
  cbseQuestionBanks: 'https://cbseacademic.nic.in/',
};

export const NCERT_CHAPTER_RESOURCE_CATALOG = {
  'Class 10': {
    Mathematics: {
      bookTitle: 'NCERT Mathematics Class X',
      bookCode: 'jemh1',
      chapters: SECONDARY_CHAPTERS.Mathematics,
    },
    Science: {
      bookTitle: 'NCERT Science Class X',
      bookCode: 'jesc1',
      chapters: SECONDARY_CHAPTERS.Science,
    },
    English: {
      bookTitle: 'NCERT First Flight Class X',
      bookCode: 'jeff1',
      chapters: ['A Letter to God', 'Nelson Mandela: Long Walk to Freedom', 'Two Stories about Flying', 'From the Diary of Anne Frank', 'Glimpses of India', 'Mijbil the Otter', 'Madam Rides the Bus', 'The Sermon at Benares', 'The Proposal'],
    },
  },
};

export const getChapterEntries = ({ className, subjectName }) => {
  const official = NCERT_CHAPTER_RESOURCE_CATALOG[className]?.[subjectName];
  const chapterNames = official?.chapters || getChapterNames({ className, subjectName });

  return chapterNames.map((chapterName, index) => {
    const chapterNumber = index + 1;
    const padded = String(chapterNumber).padStart(2, '0');
    return {
      chapterName,
      chapterNumber,
      ncertPdfUrl: official?.bookCode ? `https://ncert.nic.in/textbook/pdf/${official.bookCode}${padded}.pdf` : null,
      ncertBookTitle: official?.bookTitle || null,
      ncertTextbookUrl: OFFICIAL_RESOURCE_LINKS.ncertTextbooks,
      cbseCurriculumUrl: OFFICIAL_RESOURCE_LINKS.cbseCurriculum,
      dikshaSearchUrl: `https://diksha.gov.in/search?query=${encodeURIComponent(`${className} ${subjectName} ${chapterName}`)}`,
    };
  });
};

const SENIOR_CHAPTERS = {
  English: ['The Last Lesson', 'Lost Spring', 'Deep Water', 'My Mother at Sixty-six', 'Notice and Letter Writing'],
  Physics: ['Electric Charges and Fields', 'Current Electricity', 'Moving Charges and Magnetism', 'Ray Optics', 'Semiconductor Electronics'],
  Chemistry: ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Coordination Compounds', 'Biomolecules'],
  Mathematics: ['Relations and Functions', 'Inverse Trigonometric Functions', 'Matrices', 'Determinants', 'Continuity and Differentiability', 'Integrals'],
  Biology: ['Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Principles of Inheritance', 'Molecular Basis of Inheritance', 'Ecosystem'],
  'Computer Science': ['Python Revision Tour', 'Functions', 'File Handling', 'Data Structures', 'Database Concepts'],
  'Physical Education': ['Planning in Sports', 'Yoga and Lifestyle', 'Sports and Nutrition', 'Biomechanics', 'Psychology and Sports'],
  Accountancy: ['Accounting for Partnership Firms', 'Goodwill', 'Admission of Partner', 'Retirement of Partner', 'Financial Statements'],
  'Business Studies': ['Nature and Significance of Management', 'Principles of Management', 'Business Environment', 'Planning', 'Organising'],
  Economics: ['National Income', 'Money and Banking', 'Government Budget', 'Balance of Payments', 'Consumer Equilibrium'],
  'Applied Mathematics': ['Numbers and Quantification', 'Algebra', 'Calculus', 'Probability', 'Financial Mathematics'],
  'Informatics Practices': ['Python Pandas', 'Data Visualization', 'Database Query using SQL', 'Introduction to Computer Networks', 'Societal Impacts'],
  History: ['Bricks Beads and Bones', 'Kings Farmers and Towns', 'Colonialism and the Countryside', 'Mahatma Gandhi and the Nationalist Movement'],
  'Political Science': ['The Cold War Era', 'Contemporary Centres of Power', 'Challenges of Nation Building', 'Politics of Planned Development'],
  Geography: ['Human Geography', 'Population Distribution', 'Human Development', 'Primary Activities', 'Transport and Communication'],
  Psychology: ['Variations in Psychological Attributes', 'Self and Personality', 'Meeting Life Challenges', 'Psychological Disorders'],
};

export const getChapterNames = ({ className, subjectName }) => {
  const classNo = Number(String(className || '').match(/\d+/)?.[0] || 0);
  if (['Nursery', 'LKG', 'UKG'].includes(className)) return PRE_PRIMARY_CHAPTERS[subjectName] || PRE_PRIMARY_CHAPTERS['General Activities'];
  if (classNo >= 1 && classNo <= 5) return PRIMARY_CHAPTERS[subjectName] || PRIMARY_CHAPTERS['Moral Science'];
  if (classNo >= 6 && classNo <= 8) return MIDDLE_CHAPTERS[subjectName] || MIDDLE_CHAPTERS['Moral Science'];
  if (classNo >= 9 && classNo <= 10) return SECONDARY_CHAPTERS[subjectName] || SECONDARY_CHAPTERS['Physical Education'];
  return SENIOR_CHAPTERS[subjectName] || ['Foundations', 'Core Concepts', 'Applications', 'Project Work'];
};
