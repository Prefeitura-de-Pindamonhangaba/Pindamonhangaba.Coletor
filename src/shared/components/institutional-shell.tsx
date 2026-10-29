import Image from "next/image";
import Link from "next/link";
import { SessionControls } from "../../modules/auth/views/session-controls";

export function InstitutionalHeader({
  userName,
  guest = false,
  keysPage = false,
}: {
  userName?: string;
  guest?: boolean;
  keysPage?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#importacao">
        Ir para o conteúdo
      </a>
      <header className="institutional-header">
        <div className="institutional-ribbon">
          <div className="container">
            Prefeitura de Pindamonhangaba
            <span>Governo digital · Sistemas institucionais</span>
          </div>
        </div>
        <div className="container header-content">
          <Image
            className="institutional-logo"
            src="/brand/prefeitura-pindamonhangaba.svg"
            alt="Prefeitura Municipal de Pindamonhangaba"
            width={300}
            height={126}
            priority
            unoptimized
          />
          <div className="institutional-department">
            <strong>Tecnologia a serviço da cidade</strong>
            <span>SETIP · Departamento de Sistemas de Informação</span>
          </div>
        </div>
      </header>
      <div className="panel-bar container">
        <Link className="product-brand" href="/">
          Pinda Coletor<span aria-hidden="true">.</span>
        </Link>
        {userName ? (
          <SessionControls name={userName} />
        ) : (
          <span className="environment">Integrações municipais</span>
        )}
      </div>
      {!guest && (
        <div className="panel-nav-band">
          <nav className="container panel-nav" aria-label="Navegação principal">
            <Link href="/" aria-current={!keysPage ? "page" : undefined}>
              Importar por instrumento
            </Link>
            <Link
              href="/settings/credentials"
              aria-current={keysPage ? "page" : undefined}
            >
              Minhas chaves
            </Link>
            <a href="#guia">Guia de preenchimento</a>
            <a
              href="https://siapegov.pindamonhangaba.sp.gov.br/gcc-web/api-pc3s-swagger"
              target="_blank"
              rel="noreferrer"
            >
              Documentação da API ↗
            </a>
          </nav>
        </div>
      )}
    </>
  );
}

export function InstitutionalFooter() {
  return (
    <footer className="institutional-footer">
      <div className="container footer-content">
        <div>
          <strong>
            Pinda Coletor<span aria-hidden="true">.</span>
          </strong>
          <p>Dados integrados para a gestão municipal.</p>
        </div>
        <div>
          <strong>Prefeitura de Pindamonhangaba</strong>
          <p>SETIP · Departamento de Sistemas de Informação</p>
          <span>Coleta de dados · Finalidade administrativa</span>
        </div>
      </div>
    </footer>
  );
}
