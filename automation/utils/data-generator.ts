/**
 * @fileoverview Comprehensive Data Generator
 * @module automation/utils/data-generator
 *
 * Generate realistic fake identities for 100% autonomous operation.
 * NO user input required - everything is auto-generated.
 */

/**
 * Generated account interface
 */
export interface GeneratedAccount {
  // Basic info
  firstName: string;
  lastName: string;
  fullName: string;
  gender: 'Male' | 'Female';
  
  // Credentials
  username: string;
  email: string;
  password: string;
  
  // Contact
  phone: string;
  recoveryEmail: string;
  
  // Address
  address: GeneratedAddress;
  
  // Birth date (18-35 years old)
  birthDate: GeneratedBirthDate;
  
  // Metadata
  createdAt: string;
}

export interface GeneratedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  full: string;
}

export interface GeneratedBirthDate {
  year: number;
  month: number;
  day: number;
  formatted: string;
  monthName: string;
}

// Realistic first names (common US names)
const FIRST_NAMES_MALE = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald',
  'Steven', 'Andrew', 'Paul', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George',
  'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
  'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
  'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick',
  'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry',
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra',
  'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol',
  'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura',
  'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela',
  'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra',
  'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather', 'Diane',
  'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia', 'Victoria', 'Kelly', 'Lauren',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
  'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards',
  'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers',
];

const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd', 'Ct', 'Pl', 'Terrace'];
const STREET_NAMES = [
  'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Park',
  'Lake', 'Hill', 'Forest', 'River', 'Valley', 'Spring', 'Church', 'High',
  'Mill', 'Union', 'Market', 'Water', 'Center', 'North', 'South', 'East', 'West',
];

const CITIES: { city: string; state: string; stateCode: string; zipRange: [number, number] }[] = [
  { city: 'New York', state: 'New York', stateCode: 'NY', zipRange: [10001, 10299] },
  { city: 'Los Angeles', state: 'California', stateCode: 'CA', zipRange: [90001, 90899] },
  { city: 'Chicago', state: 'Illinois', stateCode: 'IL', zipRange: [60601, 60699] },
  { city: 'Houston', state: 'Texas', stateCode: 'TX', zipRange: [77001, 77099] },
  { city: 'Phoenix', state: 'Arizona', stateCode: 'AZ', zipRange: [85001, 85099] },
  { city: 'Philadelphia', state: 'Pennsylvania', stateCode: 'PA', zipRange: [19101, 19199] },
  { city: 'San Antonio', state: 'Texas', stateCode: 'TX', zipRange: [78201, 78299] },
  { city: 'San Diego', state: 'California', stateCode: 'CA', zipRange: [92101, 92199] },
  { city: 'Dallas', state: 'Texas', stateCode: 'TX', zipRange: [75201, 75299] },
  { city: 'San Jose', state: 'California', stateCode: 'CA', zipRange: [95101, 95199] },
  { city: 'Austin', state: 'Texas', stateCode: 'TX', zipRange: [78701, 78799] },
  { city: 'Jacksonville', state: 'Florida', stateCode: 'FL', zipRange: [32201, 32299] },
  { city: 'Fort Worth', state: 'Texas', stateCode: 'TX', zipRange: [76101, 76199] },
  { city: 'Columbus', state: 'Ohio', stateCode: 'OH', zipRange: [43201, 43299] },
  { city: 'Charlotte', state: 'North Carolina', stateCode: 'NC', zipRange: [28201, 28299] },
  { city: 'Seattle', state: 'Washington', stateCode: 'WA', zipRange: [98101, 98199] },
  { city: 'Denver', state: 'Colorado', stateCode: 'CO', zipRange: [80201, 80299] },
  { city: 'Boston', state: 'Massachusetts', stateCode: 'MA', zipRange: [2101, 2199] },
  { city: 'Nashville', state: 'Tennessee', stateCode: 'TN', zipRange: [37201, 37299] },
  { city: 'Portland', state: 'Oregon', stateCode: 'OR', zipRange: [97201, 97299] },
];

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'mail.com', 'proton.me'];

/**
 * Generate a strong random password
 */
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  let password = '';
  
  // Ensure at least one of each type
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill rest randomly (total 12-16 characters)
  const allChars = upper + lower + numbers;
  const remainingLength = 8 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < remainingLength; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate a random phone number
 */
export function generatePhoneNumber(): string {
  const areaCode = 200 + Math.floor(Math.random() * 800);
  const prefix = 200 + Math.floor(Math.random() * 800);
  const lineNum = 1000 + Math.floor(Math.random() * 9000);
  return `${areaCode}-${prefix}-${lineNum}`;
}

/**
 * Generate a random address
 */
export function generateAddress(): GeneratedAddress {
  const streetNum = 100 + Math.floor(Math.random() * 9900);
  const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)];
  const streetType = STREET_TYPES[Math.floor(Math.random() * STREET_TYPES.length)];
  const location = CITIES[Math.floor(Math.random() * CITIES.length)];
  const zip = location.zipRange[0] + Math.floor(Math.random() * (location.zipRange[1] - location.zipRange[0]));
  
  const fullStreet = `${streetNum} ${street} ${streetType}`;
  
  return {
    street: fullStreet,
    city: location.city,
    state: location.stateCode,
    zip: String(zip),
    country: 'USA',
    full: `${fullStreet}, ${location.city}, ${location.stateCode} ${zip}`,
  };
}

/**
 * Generate a random birth date (18-35 years old)
 */
export function generateBirthDate(): GeneratedBirthDate {
  const currentYear = new Date().getFullYear();
  const year = currentYear - 18 - Math.floor(Math.random() * 17); // 18-35 years old
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28); // Safe for all months
  
  return {
    year,
    month,
    day,
    formatted: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`,
    monthName: MONTH_NAMES[month],
  };
}

/**
 * Generate a complete account with all details
 * NO user input required - everything is auto-generated
 */
export function generateCompleteAccount(): GeneratedAccount {
  const isMale = Math.random() > 0.5;
  const firstNames = isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const randomNum = Math.floor(Math.random() * 9999);
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
  
  // Generate different styles of usernames
  const usernameStyles = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}${randomNum}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${randomNum}`,
  ];
  
  const username = usernameStyles[Math.floor(Math.random() * usernameStyles.length)];
  
  return {
    // Basic info
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    gender: isMale ? 'Male' : 'Female',
    
    // Credentials
    username,
    email: `${username}@${domain}`,
    password: generateStrongPassword(),
    
    // Contact
    phone: generatePhoneNumber(),
    recoveryEmail: `${firstName.toLowerCase()}${Math.floor(Math.random() * 999)}@outlook.com`,
    
    // Address
    address: generateAddress(),
    
    // Birth date
    birthDate: generateBirthDate(),
    
    // Metadata
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate a batch of accounts
 */
export function generateAccountBatch(count: number): GeneratedAccount[] {
  const accounts: GeneratedAccount[] = [];
  const usedEmails = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let account = generateCompleteAccount();
    
    // Ensure unique email
    while (usedEmails.has(account.email)) {
      account = generateCompleteAccount();
    }
    usedEmails.add(account.email);
    
    accounts.push(account);
  }
  
  return accounts;
}

/**
 * Generate random data for template interpolation
 */
export function generateRandomData(): Record<string, string> {
  const account = generateCompleteAccount();
  
  return {
    // Random identity
    randomFirstName: account.firstName,
    randomLastName: account.lastName,
    randomFullName: account.fullName,
    randomGender: account.gender,
    
    // Credentials
    randomUsername: account.username,
    randomEmail: account.email,
    randomPassword: account.password,
    randomPhone: account.phone,
    randomRecoveryEmail: account.recoveryEmail,
    
    // Address
    randomStreet: account.address.street,
    randomCity: account.address.city,
    randomState: account.address.state,
    randomZip: account.address.zip,
    randomCountry: account.address.country,
    randomFullAddress: account.address.full,
    
    // Birth date
    randomBirthYear: String(account.birthDate.year),
    randomBirthMonth: String(account.birthDate.month),
    randomBirthMonthName: account.birthDate.monthName,
    randomBirthDay: String(account.birthDate.day),
    randomBirthDate: account.birthDate.formatted,
    
    // Utility
    timestamp: Date.now().toString(),
    randomNumber: String(Math.floor(Math.random() * 10000)),
  };
}

/**
 * Generate a random YouTube channel name
 */
export function generateChannelName(): string {
  const prefixes = ['The', 'My', 'Best', 'Amazing', 'Epic', 'Ultimate', 'Pro', 'Super', 'Top'];
  const topics = [
    'Gaming', 'Tech', 'Reviews', 'Vlogs', 'Music', 'Comedy', 'Tutorials',
    'DIY', 'Cooking', 'Travel', 'Fitness', 'News', 'Entertainment', 'Life'
  ];
  const suffixes = ['Hub', 'Zone', 'World', 'Channel', 'TV', 'Show', 'Network', 'Studio', ''];
  
  const usePrefix = Math.random() > 0.5;
  const useSuffix = Math.random() > 0.3;
  
  const topic = topics[Math.floor(Math.random() * topics.length)];
  
  let name = topic;
  if (usePrefix) {
    name = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${name}`;
  }
  if (useSuffix) {
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    if (suffix) name = `${name} ${suffix}`;
  }
  
  // Sometimes add a number
  if (Math.random() > 0.7) {
    name = `${name} ${Math.floor(Math.random() * 99) + 1}`;
  }
  
  return name;
}

/**
 * Generate a random video comment
 */
export function generateVideoComment(): string {
  const comments = [
    'Great video! Really enjoyed watching this.',
    'This is exactly what I was looking for, thanks!',
    'Awesome content, keep it up!',
    'Very informative, learned a lot from this.',
    'Nice work! Subscribed for more.',
    'This was really helpful, thank you!',
    'Love your content, always entertaining.',
    'Amazing video quality!',
    'Thanks for sharing this!',
    'Perfect explanation, very clear.',
    'Just what I needed, great job!',
    'This is so underrated, more people need to see this.',
    'Came here from a recommendation, not disappointed!',
    'Your videos always brighten my day.',
    'The editing on this is top notch!',
  ];
  
  return comments[Math.floor(Math.random() * comments.length)];
}

