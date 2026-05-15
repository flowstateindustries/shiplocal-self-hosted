"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui";

export interface ConnectionsTabProps {
  ascConnected: boolean;
  ascIssuerId: string | null;
  ascKeyId: string | null;
}

export function ConnectionsTab({
  ascConnected,
  ascIssuerId,
  ascKeyId,
}: ConnectionsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>App Store Connect</CardTitle>
          <CardDescription>
            Credentials are loaded from environment variables. Edit{" "}
            <code className="font-mono text-xs">.env.local</code> to change
            them, then restart the dev server.
          </CardDescription>
        </CardHeader>

        <div className="p-4 rounded-lg bg-[var(--color-surface-secondary)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-[var(--color-content)]">App Store Connect</p>
                {ascConnected ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-content-muted)]">
                    Not configured
                  </span>
                )}
              </div>
              {ascConnected ? (
                <div className="text-sm text-[var(--color-content-muted)] space-y-0.5 font-mono">
                  {ascIssuerId && <div>Issuer: {ascIssuerId}</div>}
                  {ascKeyId && <div>Key: {ascKeyId}</div>}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-content-muted)]">
                  Set <code className="font-mono text-xs">ASC_ISSUER_ID</code>,{" "}
                  <code className="font-mono text-xs">ASC_KEY_ID</code>, and{" "}
                  <code className="font-mono text-xs">ASC_PRIVATE_KEY</code> in
                  your <code className="font-mono text-xs">.env.local</code> file.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to get App Store Connect credentials</CardTitle>
          <CardDescription>
            Generate an API key with App Manager access and copy its values.
          </CardDescription>
        </CardHeader>

        <div className="p-4 rounded-lg bg-[var(--color-surface-secondary)]">
          <ol className="text-sm text-[var(--color-content-secondary)] space-y-2 list-decimal list-inside">
            <li>
              Open{" "}
              <a
                href="https://appstoreconnect.apple.com/access/integrations/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500 hover:text-blue-400"
              >
                App Store Connect → Keys
              </a>
              .
            </li>
            <li>Click the + button and create a key with App Manager access.</li>
            <li>Download the <code className="font-mono text-xs">.p8</code> file (one-time).</li>
            <li>
              Copy the Issuer ID, Key ID, and the contents of the .p8 file into{" "}
              <code className="font-mono text-xs">.env.local</code>:
            </li>
          </ol>
          <pre className="mt-3 p-3 rounded-lg bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-content-secondary)] overflow-x-auto">
{`ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ASC_KEY_ID=XXXXXXXXXX
ASC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIG...\\n-----END PRIVATE KEY-----"`}
          </pre>
          <p className="mt-3 text-xs text-[var(--color-content-muted)]">
            Replace newlines in the private key with the literal <code className="font-mono">\n</code>{" "}
            sequence so the value stays on a single line.
          </p>
        </div>
      </Card>
    </div>
  );
}
