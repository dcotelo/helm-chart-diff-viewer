import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Helm Chart Diff Viewer',
  description: 'Compare differences between two Helm chart versions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

