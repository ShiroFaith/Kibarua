import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config/index.js';
import { applySchema } from './applySchema.js';
import { hashPassword } from '../utils/password.js';

/**
 * Seed the database with a coherent demo dataset: employers, workers, jobs,
 * applications, hirings, reviews, messages, notifications, wallets, payments
 * and recommendations - enough that every dashboard page shows real content.
 *
 * Idempotent: it clears the domain tables first, so it can be re-run freely.
 * All demo accounts share the password below.
 */
const DEMO_PASSWORD = 'Password123';

fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });
const db = new Database(config.databaseFile);
db.pragma('journal_mode = WAL');

async function seed() {
  applySchema(db);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ── Wipe existing data (children first; FKs are ON) ───────────────────────
  const tables = [
    'review_votes', 'review_disputes', 'reviews', 'messages', 'conversations',
    'notifications', 'transactions', 'invoices', 'withdrawals', 'payment_methods',
    'wallets', 'saved_jobs', 'recommendations', 'saved_searches', 'search_terms',
    'applications', 'hirings', 'jobs', 'worker_profiles', 'employer_profiles',
    'contact_messages', 'users',
  ];
  db.pragma('foreign_keys = OFF');
  const clear = db.transaction(() => {
    for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence").run();
  });
  clear();
  db.pragma('foreign_keys = ON');

  // ── Users ─────────────────────────────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, phone, is_verified, is_active)
    VALUES (@username, @email, @password_hash, @full_name, @role, @phone, 1, 1)
  `);
  const mkUser = (username, email, full_name, role, phone) =>
    insertUser.run({ username, email, password_hash: passwordHash, full_name, role, phone }).lastInsertRowid;

  const employers = [
    mkUser('acme', 'employer@demo.test', 'Grace Wanjiru', 'employer', '+254700000001'),
    mkUser('safiri', 'safiri@demo.test', 'Safiri Logistics', 'employer', '+254700000002'),
    mkUser('kilimo', 'kilimo@demo.test', 'Kilimo Fresh', 'employer', '+254700000003'),
  ];
  const workers = [
    mkUser('john', 'worker@demo.test', 'John Otieno', 'worker', '+254711000001'),
    mkUser('mary', 'mary@demo.test', 'Mary Achieng', 'worker', '+254711000002'),
    mkUser('peter', 'peter@demo.test', 'Peter Kamau', 'worker', '+254711000003'),
    mkUser('faith', 'faith@demo.test', 'Faith Njeri', 'worker', '+254711000004'),
    mkUser('brian', 'brian@demo.test', 'Brian Mwangi', 'worker', '+254711000005'),
  ];
  const admin = mkUser('admin', 'admin@demo.test', 'Platform Admin', 'admin', null);

  // ── Profiles + wallets ──────────────────────────────────────────────────────
  const insertEmployerProfile = db.prepare(`
    INSERT INTO employer_profiles (user_id, company_name, description, business_type, phone, jobs_completed, avg_rating, total_reviews)
    VALUES (@user_id, @company_name, @description, @business_type, @phone, @jobs_completed, @avg_rating, @total_reviews)
  `);
  const employerMeta = [
    { company_name: 'Acme Digital', description: 'A boutique digital agency in Nairobi.', business_type: 'Agency' },
    { company_name: 'Safiri Logistics', description: 'Moving goods across East Africa.', business_type: 'Logistics' },
    { company_name: 'Kilimo Fresh', description: 'Farm-to-table produce distribution.', business_type: 'Agriculture' },
  ];
  employers.forEach((id, i) =>
    insertEmployerProfile.run({
      user_id: id, ...employerMeta[i], phone: `+2547000000${i + 1}`,
      jobs_completed: 3 + i, avg_rating: 4.5 - i * 0.2, total_reviews: 4 + i,
    }),
  );

  const insertWorkerProfile = db.prepare(`
    INSERT INTO worker_profiles (
      user_id, professional_title, headline, bio, hourly_rate, experience_years, experience_level,
      portfolio_url, availability_status, open_to_remote, location_city, location_state, location_country,
      skills, languages, certifications, avg_rating, total_reviews, completion_percentage
    ) VALUES (
      @user_id, @professional_title, @headline, @bio, @hourly_rate, @experience_years, @experience_level,
      @portfolio_url, @availability_status, @open_to_remote, @location_city, @location_state, @location_country,
      @skills, @languages, @certifications, @avg_rating, @total_reviews, @completion_percentage
    )
  `);
  const workerMeta = [
    { professional_title: 'Full-Stack Developer', headline: 'React & Node specialist', level: 'expert',
      skills: ['JavaScript', 'React', 'Node.js', 'SQL'], rate: 2500, exp: 6, city: 'Nairobi' },
    { professional_title: 'Graphic Designer', headline: 'Brand & UI designer', level: 'intermediate',
      skills: ['Figma', 'Illustrator', 'Photoshop', 'Branding'], rate: 1800, exp: 4, city: 'Mombasa' },
    { professional_title: 'Content Writer', headline: 'SEO & marketing copy', level: 'intermediate',
      skills: ['Writing', 'SEO', 'Editing', 'Research'], rate: 1200, exp: 3, city: 'Kisumu' },
    { professional_title: 'Data Analyst', headline: 'Python & dashboards', level: 'expert',
      skills: ['Python', 'SQL', 'Excel', 'Data Analysis'], rate: 2200, exp: 5, city: 'Nairobi' },
    { professional_title: 'Digital Marketer', headline: 'Paid social & growth', level: 'entry',
      skills: ['Marketing', 'Social Media', 'Ads', 'Analytics'], rate: 1000, exp: 1, city: 'Nakuru' },
  ];
  workers.forEach((id, i) => {
    const m = workerMeta[i];
    insertWorkerProfile.run({
      user_id: id,
      professional_title: m.professional_title,
      headline: m.headline,
      bio: `${m.professional_title} with ${m.exp} years of experience. ${m.headline}.`,
      hourly_rate: m.rate,
      experience_years: m.exp,
      experience_level: m.level,
      portfolio_url: `https://portfolio.example/${id}`,
      availability_status: 'available',
      open_to_remote: 1,
      location_city: m.city,
      location_state: '',
      location_country: 'Kenya',
      skills: JSON.stringify(m.skills),
      languages: JSON.stringify(['English', 'Swahili']),
      certifications: JSON.stringify([]),
      avg_rating: 0,
      total_reviews: 0,
      completion_percentage: 85,
    });
  });

  const insertWallet = db.prepare(`
    INSERT INTO wallets (user_id, balance, currency, total_earned, total_spent, total_refunded)
    VALUES (?, ?, 'KES', ?, ?, 0)
  `);
  [...employers, ...workers, admin].forEach((id, i) => {
    const isWorker = workers.includes(id);
    insertWallet.run(id, isWorker ? 15000 + i * 1000 : 5000, isWorker ? 42000 : 0, isWorker ? 0 : 60000);
  });

  // ── Payment methods ─────────────────────────────────────────────────────────
  const insertMethod = db.prepare(`
    INSERT INTO payment_methods (user_id, method_type, provider, last_four, is_default)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertMethod.run(workers[0], 'mobile_money', 'M-Pesa', '0001', 1);
  insertMethod.run(workers[0], 'bank_transfer', 'Equity Bank', '4521', 0);
  insertMethod.run(employers[0], 'card', 'Visa', '4242', 1);

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  const insertJob = db.prepare(`
    INSERT INTO jobs (
      employer_id, title, description, category, experience_level, budget_type,
      budget_amount, budget_min, budget_max, currency, duration, deadline,
      required_skills, visibility, location_required, location_city, location_country,
      remote_allowed, status, proposals_count, views_count
    ) VALUES (
      @employer_id, @title, @description, @category, @experience_level, @budget_type,
      @budget_amount, @budget_min, @budget_max, 'KES', @duration, @deadline,
      @required_skills, 'public', @location_required, @location_city, 'Kenya',
      @remote_allowed, @status, @proposals_count, @views_count
    )
  `);
  const jobDefs = [
    { e: 0, title: 'Build a company website in React', category: 'web_development', level: 'intermediate',
      bt: 'fixed', amount: 80000, skills: ['React', 'JavaScript', 'Node.js'], duration: '1_to_4_weeks', status: 'open' },
    { e: 0, title: 'Design a brand identity & logo', category: 'design', level: 'intermediate',
      bt: 'fixed', amount: 35000, skills: ['Figma', 'Branding', 'Illustrator'], duration: 'less_than_week', status: 'open' },
    { e: 1, title: 'Write SEO blog articles (10x)', category: 'writing', level: 'entry',
      bt: 'hourly', min: 800, max: 1500, skills: ['Writing', 'SEO'], duration: '1_to_4_weeks', status: 'open' },
    { e: 1, title: 'Analyse delivery route data', category: 'data_analysis', level: 'expert',
      bt: 'fixed', amount: 60000, skills: ['Python', 'Data Analysis', 'SQL'], duration: '1_to_3_months', status: 'in_progress' },
    { e: 2, title: 'Manage social media for 3 months', category: 'digital_marketing', level: 'intermediate',
      bt: 'hourly', min: 600, max: 1200, skills: ['Marketing', 'Social Media', 'Ads'], duration: '3_to_6_months', status: 'open' },
    { e: 2, title: 'Bookkeeping for small business', category: 'accounting', level: 'intermediate',
      bt: 'fixed', amount: 25000, skills: ['Accounting', 'Excel'], duration: '1_to_4_weeks', status: 'completed' },
    { e: 0, title: 'Build a mobile app (MVP)', category: 'mobile_development', level: 'expert',
      bt: 'fixed', amount: 150000, skills: ['React', 'Node.js', 'SQL'], duration: '1_to_3_months', status: 'open' },
    // ── Casual & manual work ──
    { e: 0, title: 'House cleaning for a 3-bedroom apartment', category: 'cleaning', level: 'entry',
      bt: 'fixed', amount: 2500, skills: ['Cleaning'], duration: 'less_than_week', status: 'open', city: 'Nairobi', remote: 0 },
    { e: 2, title: 'Fix a leaking kitchen sink and taps', category: 'plumbing', level: 'intermediate',
      bt: 'fixed', amount: 3500, skills: ['Plumbing'], duration: 'less_than_week', status: 'open', city: 'Mombasa', remote: 0 },
    { e: 1, title: 'Garden landscaping and lawn care', category: 'gardening', level: 'entry',
      bt: 'hourly', min: 500, max: 900, skills: ['Gardening', 'Landscaping'], duration: '1_to_4_weeks', status: 'open', city: 'Nairobi', remote: 0 },
    { e: 0, title: 'Cook for a weekend event (50 guests)', category: 'cooking', level: 'intermediate',
      bt: 'fixed', amount: 15000, skills: ['Cooking', 'Catering'], duration: 'less_than_week', status: 'open', city: 'Kisumu', remote: 0 },
    { e: 2, title: 'Paint a 2-bedroom house (interior)', category: 'painting', level: 'intermediate',
      bt: 'fixed', amount: 12000, skills: ['Painting'], duration: '1_to_4_weeks', status: 'open', city: 'Nakuru', remote: 0 },
    { e: 1, title: 'House help / domestic worker (live-out)', category: 'domestic_work', level: 'entry',
      bt: 'fixed', amount: 18000, skills: ['House Help', 'Cleaning', 'Cooking'], duration: 'more_than_6_months', status: 'open', city: 'Nairobi', remote: 0 },
    { e: 0, title: 'Movers needed for office relocation', category: 'moving', level: 'entry',
      bt: 'fixed', amount: 8000, skills: ['Moving', 'Lifting'], duration: 'less_than_week', status: 'open', city: 'Nairobi', remote: 0 },
  ];
  const jobIds = jobDefs.map((j) =>
    insertJob.run({
      employer_id: employers[j.e],
      title: j.title,
      description: `${j.title}. We are looking for a reliable professional to deliver high-quality work on schedule. Please share relevant samples with your proposal.`,
      category: j.category,
      experience_level: j.level,
      budget_type: j.bt,
      budget_amount: j.bt === 'fixed' ? j.amount : 0,
      budget_min: j.bt === 'hourly' ? j.min : 0,
      budget_max: j.bt === 'hourly' ? j.max : 0,
      duration: j.duration,
      deadline: null,
      required_skills: JSON.stringify(j.skills),
      location_required: j.remote === 0 ? 1 : 0,
      location_city: j.city || 'Nairobi',
      remote_allowed: j.remote === undefined ? 1 : j.remote,
      status: j.status,
      proposals_count: 0,
      views_count: 10 + Math.round(j.amount ? j.amount / 5000 : 5),
    }).lastInsertRowid,
  );

  // ── Applications ──────────────────────────────────────────────────────────────
  const insertApp = db.prepare(`
    INSERT INTO applications (job_id, worker_id, cover_letter, bid_amount, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const bumpProposals = db.prepare('UPDATE jobs SET proposals_count = proposals_count + 1 WHERE id = ?');
  const appDefs = [
    { j: 0, w: 0, bid: 78000, status: 'pending' },
    { j: 0, w: 3, bid: 82000, status: 'pending' },
    { j: 1, w: 1, bid: 34000, status: 'pending' },
    { j: 2, w: 2, bid: 1000, status: 'pending' },
    { j: 3, w: 3, bid: 60000, status: 'hired' },
    { j: 5, w: 3, bid: 25000, status: 'hired' },
    { j: 4, w: 4, bid: 900, status: 'pending' },
    { j: 6, w: 0, bid: 145000, status: 'pending' },
    { j: 7, w: 1, bid: 2500, status: 'pending' },   // cleaning
    { j: 9, w: 4, bid: 700, status: 'pending' },    // gardening
  ];
  appDefs.forEach((a) => {
    insertApp.run(jobIds[a.j], workers[a.w],
      'I have relevant experience and can start immediately. Looking forward to working with you.',
      a.bid, a.status);
    bumpProposals.run(jobIds[a.j]);
  });

  // ── Hirings (basis for reviews) ─────────────────────────────────────────────
  const insertHiring = db.prepare(`
    INSERT INTO hirings (job_id, employer_id, worker_id, amount, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const hiring1 = insertHiring.run(jobIds[3], employers[1], workers[3], 60000, 'active', null).lastInsertRowid;
  const hiring2 = insertHiring.run(jobIds[5], employers[2], workers[3], 25000, 'completed', fiveDaysAgo).lastInsertRowid;

  // ── Reviews (worker <-> employer) ───────────────────────────────────────────
  const insertReview = db.prepare(`
    INSERT INTO reviews (
      hiring_id, job_id, reviewer_id, reviewee_id, review_type, rating, title, description,
      quality_rating, communication_rating, timeliness_rating, professionalism_rating,
      response_text, response_at
    ) VALUES (
      @hiring_id, @job_id, @reviewer_id, @reviewee_id, @review_type, @rating, @title, @description,
      @quality, @communication, @timeliness, @professionalism, @response_text, @response_at
    )
  `);
  // Employer reviews the worker (for_worker).
  insertReview.run({
    hiring_id: hiring2, job_id: jobIds[5], reviewer_id: employers[2], reviewee_id: workers[3],
    review_type: 'for_worker', rating: 5, title: 'Excellent work',
    description: 'Delivered ahead of schedule and communicated clearly throughout.',
    quality: 5, communication: 5, timeliness: 5, professionalism: 5,
    response_text: 'Thank you, it was a pleasure working with you!', response_at: null,
  });
  // A second worker review from another employer to enrich stats.
  insertReview.run({
    hiring_id: hiring1, job_id: jobIds[3], reviewer_id: employers[1], reviewee_id: workers[3],
    review_type: 'for_worker', rating: 4, title: 'Great analyst',
    description: 'Solid analysis and useful dashboards. Minor delays but good outcome.',
    quality: 4, communication: 4, timeliness: 3, professionalism: 5,
    response_text: null, response_at: null,
  });
  // Worker reviews the employer (for_employer).
  insertReview.run({
    hiring_id: hiring2, job_id: jobIds[5], reviewer_id: workers[3], reviewee_id: employers[2],
    review_type: 'for_employer', rating: 5, title: 'Great client',
    description: 'Clear brief, prompt payment. Would work with again.',
    quality: 5, communication: 5, timeliness: 5, professionalism: 5,
    response_text: null, response_at: null,
  });

  // Refresh cached aggregates for reviewed users.
  const refreshAgg = (userId, type, table) => {
    const agg = db.prepare('SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE reviewee_id=? AND review_type=?').get(userId, type);
    db.prepare(`UPDATE ${table} SET avg_rating=?, total_reviews=? WHERE user_id=?`)
      .run(agg.a ? Math.round(agg.a * 100) / 100 : 0, agg.n || 0, userId);
  };
  refreshAgg(workers[3], 'for_worker', 'worker_profiles');
  refreshAgg(employers[2], 'for_employer', 'employer_profiles');

  // ── Conversations + messages ────────────────────────────────────────────────
  const insertConvo = db.prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)');
  const insertMsg = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, recipient_id, message_body, is_read)
    VALUES (?, ?, ?, ?, ?)
  `);
  const conv1 = insertConvo.run(Math.min(employers[0], workers[0]), Math.max(employers[0], workers[0])).lastInsertRowid;
  insertMsg.run(conv1, employers[0], workers[0], 'Hi John, I liked your proposal for the website. Are you available this week?', 1);
  insertMsg.run(conv1, workers[0], employers[0], 'Hello Grace! Yes, I can start on Monday. Shall we set up a quick call?', 1);
  insertMsg.run(conv1, employers[0], workers[0], 'Perfect. Let me send over the brief and designs.', 0);

  const conv2 = insertConvo.run(Math.min(employers[1], workers[3]), Math.max(employers[1], workers[3])).lastInsertRowid;
  insertMsg.run(conv2, employers[1], workers[3], 'The route data is in the shared folder. Let me know if you need anything.', 0);

  // ── Notifications ─────────────────────────────────────────────────────────────
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, notification_type, title, message, link, is_read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run(employers[0], 'proposal', 'New proposal received', 'John Otieno applied to "Build a company website in React"', 'dashboard/post-job.html', 0);
  insertNotif.run(employers[0], 'proposal', 'New proposal received', 'Faith Njeri applied to your job', 'dashboard/post-job.html', 0);
  insertNotif.run(workers[3], 'proposal', 'You were hired!', 'You have been hired for "Analyse delivery route data"', 'dashboard/dashboard.html', 0);
  insertNotif.run(workers[3], 'review', 'New review received', 'Kilimo Fresh left you a 5-star review', 'dashboard/reviews.html', 1);
  insertNotif.run(workers[0], 'message', 'New message', 'Grace Wanjiru sent you a message', 'dashboard/messages.html', 0);
  insertNotif.run(workers[0], 'job_match', 'New job match', 'A new job matches your skills: Build a mobile app (MVP)', 'dashboard/recommendations.html', 0);

  // ── Transactions + invoices ─────────────────────────────────────────────────
  const insertTxn = db.prepare(`
    INSERT INTO transactions (payer_id, payee_id, amount, currency, transaction_type, status, reference, description)
    VALUES (?, ?, ?, 'KES', ?, 'completed', ?, ?)
  `);
  insertTxn.run(employers[2], workers[3], 25000, 'payment', 'TXN-1001', 'Payment for bookkeeping job');
  insertTxn.run(null, workers[3], 25000, 'payout', 'TXN-1002', 'Payout to wallet');
  insertTxn.run(employers[0], null, 5000, 'deposit', 'TXN-1003', 'Wallet top-up');

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_number, issuer_id, recipient_id, job_id, amount, currency, status, due_date)
    VALUES (?, ?, ?, ?, ?, 'KES', ?, date('now','+14 days'))
  `);
  insertInvoice.run('INV-2001', workers[3], employers[2], jobIds[5], 25000, 'paid');
  insertInvoice.run('INV-2002', workers[3], employers[1], jobIds[3], 60000, 'pending');

  // ── Saved jobs + search terms ───────────────────────────────────────────────
  const saveJob = db.prepare('INSERT OR IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)');
  saveJob.run(workers[0], jobIds[6]);
  saveJob.run(workers[0], jobIds[1]);

  const insertTerm = db.prepare('INSERT OR IGNORE INTO search_terms (term, kind, popularity) VALUES (?, ?, ?)');
  [['web developer', 'job', 42], ['graphic designer', 'job', 28], ['data analyst', 'job', 19],
   ['content writer', 'job', 15], ['react', 'job', 33]].forEach(([t, k, p]) => insertTerm.run(t, k, p));

  // ── Report ────────────────────────────────────────────────────────────────────
  const count = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  console.log('✅ Seed complete:');
  for (const t of ['users', 'jobs', 'applications', 'hirings', 'reviews', 'messages', 'notifications', 'transactions', 'invoices']) {
    console.log(`   ${t.padEnd(14)} ${count(t)}`);
  }
  console.log(`\n   Demo login → employer@demo.test / worker@demo.test / admin@demo.test`);
  console.log(`   Password   → ${DEMO_PASSWORD}`);
}

seed()
  .then(() => db.close())
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    db.close();
    process.exit(1);
  });
