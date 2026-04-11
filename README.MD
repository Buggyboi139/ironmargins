# Iron Margins

## Overview
Iron Margins is a Software-as-a-Service (SaaS) application engineered for estimating, bidding, and invoice management. Built as a Progressive Web App (PWA), it executes complex financial calculations, manages user authentication flows, and handles document generation natively within the browser environment.

## Architecture & Application Logic
The platform operates on a modular client-side architecture with offline-first capabilities.

* **Core Application (`/app/`):** Business logic is segmented into dedicated modules (`bids.js`, `billing.js`, `invoices.js`, `builder.js`) to handle specific operational domains.
* **State & Computation:** Financial modeling and margin calculations are processed locally (`calculate.js`), dynamically consuming structured data configurations (`materials.json`, `templates.json`).
* **Authentication Flow:** Session states and access controls for the core application portal are managed via localized routing (`auth.js`).
* **Progressive Web App (PWA):** Implements a Service Worker (`sw.js`) and web manifest to enforce asset caching, offline persistence, and native-like installation behavior.

## Technology Stack
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Architecture:** Progressive Web App (PWA)
* **Data Storage:** JSON

## Threat Model & Security Considerations
This project was constructed to demonstrate a comprehensive understanding of business logic vulnerabilities and the inherent risks of client-side trust models in modern web applications.

### 1. Business Logic & Client-Side Trust Manipulation
* **Vector:** Heavy financial computations and bid generation occur on the client. An attacker could utilize browser dev tools or intercept proxy traffic to manipulate state variables, altering invoice totals, forcing negative margins, or bypassing standard billing constraints.
* **Mitigation Strategy:** In a fully integrated production environment, the client-side UI serves only as a representation. All financial payloads and final invoice generation must be strictly recalculated and validated server-side before database commits or payment processing.

### 2. Authentication Bypass & Authorization Failures
* **Vector:** Authentication states managed purely within the client environment (`auth.js`) are vulnerable to state manipulation. An attacker could alter local storage, session variables, or JavaScript execution paths to forcefully validate a session and access the restricted `/app/` directory.
* **Mitigation Strategy:** Client-side authentication is treated strictly as a UX feature. Actual security relies on robust server-side session management (e.g., HTTP-only JWTs) with authorization explicitly verified on every API request.

### 3. Service Worker Hijacking (PWA)
* **Vector:** The inclusion of `sw.js` for offline caching introduces a persistent client-side execution environment. If a Cross-Site Scripting (XSS) vulnerability were introduced via user input (e.g., malicious invoice notes), an attacker could theoretically poison the service worker, allowing them to persistently intercept and modify application traffic.
* **Mitigation Strategy:** Implementation of a strict Content Security Policy (CSP) and rigorous context-aware output encoding across all input fields to eliminate initial XSS vectors.

## Deployment
Engineered for static hosting environments (e.g., GitHub Pages) with complete PWA compliance, allowing for seamless cross-platform deployment and offline operability.
