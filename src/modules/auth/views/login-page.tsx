import {
  InstitutionalHeader,
  InstitutionalFooter,
} from "../../../shared/components/institutional-shell";
import { LoginButton } from "./login-button";
export function LoginPage({
  configured,
  hasError,
}: {
  configured: boolean;
  hasError: boolean;
}) {
  return (
    <div className="shell">
      <InstitutionalHeader guest />
      <main id="importacao" className="welcome-layout" tabIndex={-1}>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <span className="eyebrow">Dados a serviço da cidade</span>
          <h1 id="welcome-title">
            Pinda Coletor<span aria-hidden="true">.</span>
          </h1>
          <p className="introduction">
            Coleta de dados para a gestão municipal.
          </p>
          <p className="welcome-description">
            Uma plataforma para importar planilhas, organizar informações e
            simplificar o envio de dados aos sistemas municipais.
          </p>
          <div className="welcome-access">
            <LoginButton enabled={configured} />
            <p>Entre com sua conta institucional da Prefeitura.</p>
          </div>
          {(!configured || hasError) && (
            <p className="welcome-alert" role="alert">
              {!configured
                ? "O acesso institucional está indisponível. Entre em contato com o DSI."
                : "Acesso institucional não autorizado ou indisponível. Entre em contato com o DSI."}
            </p>
          )}
        </section>
        <aside className="welcome-details" aria-label="Sobre a plataforma">
          <div>
            <span className="eyebrow">01 · Integração</span>
            <h2>Dados organizados para envio</h2>
            <p>
              Planilhas por instrumento, com conferência das informações antes
              do envio ao sistema de destino.
            </p>
          </div>
          <div>
            <span className="eyebrow">02 · Segurança</span>
            <h2>Suas chaves, seu acesso</h2>
            <p>
              Conta institucional e chaves de integração pessoais, protegidas e
              selecionadas a cada envio.
            </p>
          </div>
          <p className="welcome-notice">
            Uso exclusivo de servidores autorizados, para finalidades
            administrativas. Para solicitar acesso, entre em contato com o DSI.
          </p>
        </aside>
      </main>
      <InstitutionalFooter />
    </div>
  );
}
