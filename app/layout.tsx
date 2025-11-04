import './globals.css'

export const metadata = {
  title: 'FPS Strike - Web Based Counter Strike',
  description: 'Play a Counter Strike inspired FPS game in your browser',
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
