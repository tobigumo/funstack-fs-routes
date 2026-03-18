export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>funstack-fs-routes example</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
