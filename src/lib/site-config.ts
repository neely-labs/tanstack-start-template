export const siteConfig = {
  description:
    "A production-minded TanStack Start foundation with a strict, fast feedback loop.",
  /** Header logo and SVG favicon. Replace the file, keep the shape. */
  icon: { path: "/tanstack.svg", type: "image/svg+xml" },
  language: "en-US",
  locale: "en_US",
  name: "TanStack Start Template",
  navigation: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/runtime", label: "Runtime" },
  ],
  origin: "https://example.com",
  /** Installed-application name. Keep it short enough to sit under an icon. */
  shortName: "Start Template",
  socialImage: {
    alt: "TanStack Start Template. Production-minded and ready to build.",
    height: 630,
    path: "/social-card.png",
    type: "image/png",
    width: 1200,
  },
  /** Browser UI colour. Match the `--background` token in `src/styles.css`. */
  themeColor: "#f7f9f9",
} as const;
