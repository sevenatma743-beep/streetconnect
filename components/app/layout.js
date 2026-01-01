import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'StreetConnect',
  description: 'Réseau social skate & streetwear'
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}