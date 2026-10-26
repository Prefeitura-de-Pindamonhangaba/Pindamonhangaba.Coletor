import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Coletor Municipal | Pindamonhangaba",
  description:
    "Importação de planilhas para a prestação de contas do terceiro setor.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
