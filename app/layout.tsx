import '../styles/globals.css'
import type { ReactNode } from 'react'
import Providers from '../components/Providers'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'CHAIN SCOPE V2',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
