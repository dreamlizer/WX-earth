# Feature Domain Routing

This document is the authoritative contract for opening homepage features from production subdomains.

## Ownership

- `lib/feature_domains.ts` owns hostname normalization, the primary-domain setting, and the subdomain mapping.
- `app/page.tsx` resolves the browser hostname after startup and opens the mapped app mode or Super Map modal.
- Closing a feature opened from a mapped subdomain navigates back to the primary-domain homepage.

The primary domain defaults to `executiveinsider.top` and can be overridden at build/runtime exposure time with `NEXT_PUBLIC_PRIMARY_DOMAIN`.

## Current Mapping

| Subdomain | Aliases | Target |
|---|---|---|
| `map` | — | Super Map modal |
| `exam` | — | Middle-school exam |
| `pikachu` | `volleyball` | Pikachu Volleyball |
| `code` | `codebreaker` | Code Breaker |
| `solar` | — | Solar System |
| `shaft` | `ns` | NS-SHAFT |
| `dict` | `dictionary` | Dictionary |
| `assessment` | `assess` | Assessment hub |
| `suika` | — | Daxigua |
| `winlinez` | `lines` | WinLinez |
| `ocr` | — | OCR workbench |
| `skill` | `skills` | Skill hub |
| `chat` | `conversation` | Conversation lab |

The world clock currently has no feature-domain mapping and remains a homepage-card entry.

## Routing Rules

- The primary domain and `www` host stay on the homepage.
- Only exact subdomains or listed aliases under the configured primary domain are matched.
- A conversation query containing `c` takes precedence over feature-domain opening.
- Routing is client-side; DNS, TLS certificates, and reverse-proxy wildcard host handling are external prerequisites and are not configured by this file.

## Verification

1. Run `npm run build`.
2. In a browser where the test hostname resolves to the app, open each maintained subdomain.
3. Confirm the correct app mode or modal opens.
4. Close it and confirm navigation returns to the primary-domain homepage.
5. Confirm an unknown subdomain does not silently open a feature.

Code presence alone does not prove DNS/TLS or live routing. Record those checks separately when releasing this feature.
