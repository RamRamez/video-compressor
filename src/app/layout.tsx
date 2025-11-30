import { Geist, Geist_Mono } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
import type { Metadata } from 'next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Pulse Compress',
  description: 'Client-side FFmpeg video compressor with modern UI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`}
      >
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
