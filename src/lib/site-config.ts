export const siteConfig = {
  description:
    "A production-minded TanStack Start foundation with a strict, fast feedback loop.",
  language: "en-US",
  locale: "en_US",
  name: "TanStack Start Template",
  navigation: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
  ],
  origin: "https://example.com",
  socialImage: {
    alt: "TanStack Start Template. Production-minded and ready to build.",
    height: 630,
    path: "/social-card.png",
    type: "image/png",
    width: 1200,
  },
} as const;
