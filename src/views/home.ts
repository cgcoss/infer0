import { html } from "hono/html";
import { Layout } from "./layout";

interface HomeViewProps {
  user?: { name: string | null; email: string; avatar_url: string | null } | null;
}

export function HomeView({ user }: HomeViewProps) {
  return Layout({
    title: "Home",
    user,
    children: html`
      <div class="container">
        <section class="hero">
          <div class="badge-group">
            <span class="badge">OpenAI</span>
            <span class="badge">Anthropic</span>
            <span class="badge">Google</span>
            <span class="badge">+ any provider</span>
          </div>
          <h1>One API. Every provider.<br />Your users decide.</h1>
          <p>
            infer0 is an inference routing service. Developers integrate a single
            OpenAI-compatible API. End users bring their own provider account.
          </p>
          <div>
            <a href="/docs" class="btn-primary">Read the docs</a>
          </div>
        </section>

        <section>
          <h2>How it works</h2>
          <div class="flow">
            <div class="flow-step">
              <div class="num">1</div>
              <p>Developer calls<br />infer0 API</p>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="num">2</div>
              <p>infer0 looks up<br />user's provider</p>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="num">3</div>
              <p>Request routed to<br />user's provider</p>
            </div>
            <span class="flow-arrow">→</span>
            <div class="flow-step">
              <div class="num">4</div>
              <p>Response returned<br />to developer</p>
            </div>
          </div>
        </section>

        <section>
          <h2>For Developers</h2>
          <div class="grid">
            <div class="card">
              <h3>Single Integration</h3>
              <p>One OpenAI-compatible API. No need to support every provider individually.</p>
            </div>
            <div class="card">
              <h3>User Choice</h3>
              <p>Let users pick their preferred provider and bring their own API key.</p>
            </div>
            <div class="card">
              <h3>No Key Management</h3>
              <p>We handle provider API key storage and encryption. You never touch them.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>For End Users</h2>
          <div class="grid">
            <div class="card">
              <h3>Your Account, Your Keys</h3>
              <p>Connect your existing OpenAI, Anthropic, or Google account. No need to share credentials.</p>
            </div>
            <div class="card">
              <h3>Use What You Pay For</h3>
              <p>Already have a subscription? Use it across any infer0-integrated app.</p>
            </div>
            <div class="card">
              <h3>Full Control</h3>
              <p>Add, remove, or switch providers anytime from your dashboard.</p>
            </div>
          </div>
        </section>
      </div>
    `,
  });
}
