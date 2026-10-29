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
      <main id="importacao" className="login-layout">
        <section className="login-introduction">
          <span className="eyebrow">ACESSO INSTITUCIONAL</span>
          <h1>
            Pinda Coletor<span>.</span>
          </h1>
          <p>Coleta de dados para a gestão municipal.</p>
          <p>
            Entre com sua conta institucional para importar planilhas e
            gerenciar suas chaves de integração.
          </p>
        </section>
        <section className="login-panel">
          <h2>Entrar no sistema</h2>
          <p>Use a mesma identidade institucional utilizada no Pinda Dados.</p>
          <LoginButton enabled={configured} />
          {!configured && (
            <p className="notice">
              O login Keycloak ainda não está configurado. O administrador deve
              preencher as variáveis de autenticação no servidor e habilitar o
              acesso.
            </p>
          )}
          {hasError && (
            <p className="form-error" role="alert">
              Não foi possível concluir o acesso. Confira com o administrador se
              sua conta está habilitada e vinculada ao Keycloak.
            </p>
          )}
          <p className="field-help">
            A autenticação acontece no Keycloak. Sua senha não é solicitada nem
            armazenada pelo coletor.
          </p>
        </section>
      </main>
      <InstitutionalFooter />
    </div>
  );
}
