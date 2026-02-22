export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to WF Platform
        </h1>
        <p className="text-xl text-gray-600">
          Multi-tenant SaaS platform with AI-powered insights
        </p>
        <div className="mt-8 space-y-2">
          <p className="text-sm text-gray-500">
            Built with Next.js 15, TypeScript, and Tailwind CSS
          </p>
          <p className="text-sm text-gray-500">
            App Router | Turborepo Monorepo | Drizzle ORM
          </p>
        </div>
      </div>
    </main>
  );
}
