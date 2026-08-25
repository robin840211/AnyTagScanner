import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegistration from './pwa-registration';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteUrl = new URL(
  configuredSiteUrl
    ? `${configuredSiteUrl.replace(/\/$/, '')}/`
    : 'http://localhost:3000/',
);
const socialImageUrl = new URL('og.png', siteUrl).toString();
const manifestUrl = new URL('manifest.webmanifest', siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'TagScanner — QR、條碼與視覺標記掃描器',
  description:
    '在手機或電腦瀏覽器中辨識 QR Code、一般條碼、ArUco 與 tag36h11 AprilTag；影像只在目前裝置處理。',
  applicationName: 'TagScanner',
  manifest: manifestUrl,
  keywords: ['QR Code', 'Barcode', 'ArUco', 'AprilTag', 'Scanner'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TagScanner',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    title: 'TagScanner — One view. Every mark.',
    description:
      '跨裝置辨識 QR Code、一般條碼、ArUco 與 tag36h11 AprilTag。',
    url: siteUrl,
    siteName: 'TagScanner',
    images: [
      {
        url: socialImageUrl,
        width: 1792,
        height: 1024,
        alt: 'TagScanner — One view. Every mark.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TagScanner — One view. Every mark.',
    description: '跨裝置的 QR、條碼與視覺標記掃描器。',
    images: [socialImageUrl],
  },
};

export const viewport: Viewport = {
  themeColor: '#090d11',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
