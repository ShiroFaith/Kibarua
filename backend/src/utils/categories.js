/**
 * Single source of truth for job categories. Kibarua covers BOTH casual/manual
 * work (the informal workforce it's built for) and skilled/digital work.
 * Slugs are stored on jobs.category; labels are for display.
 */
export const JOB_CATEGORIES = [
  // Casual & manual work
  'cleaning', 'domestic_work', 'cooking', 'plumbing', 'electrical', 'carpentry',
  'painting', 'masonry', 'welding', 'mechanic', 'gardening', 'farming', 'moving',
  'tailoring', 'security', 'beauty', 'tutoring',
  // Skilled & digital work
  'web_development', 'mobile_development', 'design', 'writing', 'digital_marketing',
  'data_analysis', 'accounting', 'administrative',
  'other',
];

export const CATEGORY_LABELS = {
  cleaning: 'Cleaning',
  domestic_work: 'House Help / Domestic',
  cooking: 'Cooking & Catering',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  carpentry: 'Carpentry',
  painting: 'Painting',
  masonry: 'Masonry & Construction',
  welding: 'Welding & Fabrication',
  mechanic: 'Auto Mechanic',
  gardening: 'Gardening & Landscaping',
  farming: 'Farm Work / Agriculture',
  moving: 'Moving & Delivery',
  tailoring: 'Tailoring',
  security: 'Security',
  beauty: 'Beauty & Salon',
  tutoring: 'Tutoring & Lessons',
  web_development: 'Web Development',
  mobile_development: 'Mobile Development',
  design: 'Design & UX',
  writing: 'Writing & Content',
  digital_marketing: 'Digital Marketing',
  data_analysis: 'Data Analysis',
  accounting: 'Accounting & Finance',
  administrative: 'Administrative',
  other: 'Other',
};

export default JOB_CATEGORIES;
