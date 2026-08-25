import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegistration from './pwa-registration';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteUrl = new URL(
  configuredSiteUrl
    ? `${configuredSiteUrl.replace(/\/$/, '')}/`
    : 'http://localhost:3000/',
);
const manifestUrl = new URL('manifest.webmanifest', siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'TagScanner — QR、條碼、ArUco 與 AprilTag 辨識',
  description:
    '使用手機或電腦瀏覽器辨識 QR Code、常見條碼、OpenCV ArUco Original 與 AprilTag 36h11；影像只在目前裝置處理。',
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
    title: 'TagScanner — QR、條碼與視覺標記辨識',
    description:
      '使用相機或圖片辨識 QR Code、常見條碼、ArUco Original 與 AprilTag 36h11。',
    url: siteUrl,
    siteName: 'TagScanner',
  },
  twitter: {
    card: 'summary',
    title: 'TagScanner — QR、條碼與視覺標記辨識',
    description: '使用瀏覽器辨識常用條碼與 OpenCV 相容標記。',
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
