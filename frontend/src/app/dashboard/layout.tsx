import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - CodeMitra',
  description: 'Welcome to your CodeMitra dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
