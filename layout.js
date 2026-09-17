import "./globals.css";
export const metadata = { title: "Givee — Giveaways made simple", description: "A clean giveaway platform." };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}