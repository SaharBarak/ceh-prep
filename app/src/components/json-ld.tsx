/**
 * Schema.org JSON-LD injector.
 *
 * Server-rendered <script type="application/ld+json">. Google's
 * structured-data parser reads this; React's serializer would otherwise
 * escape the angle-brackets in the JSON, so we go through
 * dangerouslySetInnerHTML.
 *
 * Generic over the schema body; callers pass the fully-typed @graph or
 * single object. Use the `Course` and `Article` helpers below for the
 * two shapes we actually use.
 */
export const JsonLd = ({ data }: { data: object }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data),
    }}
  />
);

const ORG = {
  "@type": "Organization",
  name: "CEH Prep",
  url: "https://cehprep.dev",
} as const;

export const courseSchema = ({
  dayNumber,
  title,
  description,
  url,
}: {
  dayNumber: number;
  title: string;
  description: string;
  url: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Course",
  name: `Day ${dayNumber} — ${title}`,
  description,
  url,
  courseCode: `CEH-D${String(dayNumber).padStart(2, "0")}`,
  inLanguage: "en",
  provider: ORG,
  educationalLevel: "Professional certification preparation",
  about: "Certified Ethical Hacker (CEH v13)",
  hasCourseInstance: {
    "@type": "CourseInstance",
    courseMode: "Online",
    courseWorkload: "PT30M",
  },
});

export const articleSchema = ({
  title,
  description,
  url,
  datePublished,
}: {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description,
  url,
  ...(datePublished && { datePublished }),
  publisher: ORG,
  author: ORG,
});
