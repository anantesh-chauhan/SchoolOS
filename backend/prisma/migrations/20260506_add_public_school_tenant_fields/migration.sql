ALTER TABLE "School"
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "theme" JSONB,
ADD COLUMN IF NOT EXISTS "config" JSONB;

UPDATE "School"
SET
  "slug" = COALESCE(
    "slug",
    lower(regexp_replace(coalesce("schoolCode", "schoolName"), '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  "theme" = COALESCE(
    "theme",
    jsonb_build_object(
      'primaryColor', '#' || substring(md5(coalesce("schoolCode", "schoolName")), 1, 6),
      'secondaryColor', '#' || substring(md5(coalesce("schoolCode", "schoolName") || '-secondary'), 1, 6),
      'accentColor', '#f59e0b',
      'fontFamily', 'Manrope'
    )
  ),
  "config" = COALESCE(
    "config",
    jsonb_build_object(
      'theme', jsonb_build_object(
        'primaryColor', '#' || substring(md5(coalesce("schoolCode", "schoolName")), 1, 6),
        'secondaryColor', '#' || substring(md5(coalesce("schoolCode", "schoolName") || '-secondary'), 1, 6),
        'accentColor', '#f59e0b',
        'fontFamily', 'Manrope'
      ),
      'pages', jsonb_build_array(
        jsonb_build_object('name', 'Home', 'path', '/'),
        jsonb_build_object('name', 'About', 'path', '/about'),
        jsonb_build_object('name', 'Admissions', 'path', '/admissions'),
        jsonb_build_object('name', 'Events', 'path', '/events'),
        jsonb_build_object('name', 'Gallery', 'path', '/gallery'),
        jsonb_build_object('name', 'Contact', 'path', '/contact')
      ),
      'homepage', jsonb_build_object(
        'title', 'Welcome to ' || coalesce("schoolName", 'School'),
        'subtitle', 'A dynamic school experience for families in ' || coalesce("city", 'your city')
      ),
      'sections', jsonb_build_array(
        jsonb_build_object(
          'type', 'hero',
          'data', jsonb_build_object(
            'title', 'Welcome to ' || coalesce("schoolName", 'School'),
            'subtitle', coalesce("schoolName", 'School') || ' serves learners with a future-ready campus experience.',
            'primaryCta', jsonb_build_object('label', 'Admissions', 'path', '/admissions'),
            'secondaryCta', jsonb_build_object('label', 'Explore School', 'path', '/about')
          )
        ),
        jsonb_build_object(
          'type', 'about',
          'data', jsonb_build_object(
            'title', 'About ' || coalesce("schoolName", 'School'),
            'description', coalesce("schoolName", 'School') || ' serves families in ' || coalesce("city", 'your city') || ', ' || coalesce("state", 'your state') || '.',
            'highlights', jsonb_build_array(
              'Serving learners in ' || coalesce("city", 'your city'),
              'Campus community in ' || coalesce("state", 'your state'),
              'Default content generated for public launch'
            )
          )
        )
      )
    )
  );

ALTER TABLE "School"
ALTER COLUMN "slug" SET NOT NULL;
