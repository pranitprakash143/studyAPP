import "@/lib/logger"; // Global console logs redirect server-side
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AIConfigProvider } from "@/contexts/AIConfigContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrepAgent - AI Study Assistant",
  description: "High-yield note generation, interactive MCQ quizzes, and PYQ analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const settings = JSON.parse(localStorage.getItem('prepagent_settings') || '{}');
                // Support legacy mapping or default
                let theme = settings.theme || 'theme-dark';
                if (theme === 'light') theme = 'theme-light';
                if (theme === 'dark') theme = 'theme-dark';

                // Clear all theme selectors
                document.documentElement.classList.remove(
                  'theme-light',
                  'theme-dark',
                  'theme-sepia',
                  'theme-forest',
                  'theme-ocean',
                  'dark'
                );

                // Apply dynamic theme
                document.documentElement.classList.add(theme);

                // Add dark class as fallback for all themes except light theme
                if (theme !== 'theme-light') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans h-full transition-colors duration-250`}>
        <AIConfigProvider>
          {children}
        </AIConfigProvider>
      </body>
    </html>
  );
}
