/*
  Sistema de Gestão Pericial - protótipo front-end completo executado localmente.
  Todos os dados são armazenados em localStorage e manipulados via TypeScript.
*/

type Role = 'admin' | 'perito' | 'assistente';
type TaskStatus = 'a_fazer' | 'em_andamento' | 'concluido';
type HonorarioStatus = 'previsto' | 'recebido' | 'atrasado';
type ProcessStatus =
  | 'aguardando_documento'
  | 'em_andamento'
  | 'pericia_agendada'
  | 'laudo_entregue'
  | 'concluido';
type ExpenseStatus = 'pago' | 'nao_pago';
type NotificationType = 'prazo' | 'agenda' | 'honorario' | 'tarefa';

interface NotificationPreference {
  prazos: boolean;
  agenda: boolean;
  honorarios: boolean;
  tarefas: boolean;
}

interface User {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  senha: string;
  perfil: Role;
  preferencias: NotificationPreference;
}

interface SessionInfo {
  userId: string;
  expiresAt: number;
}

interface CaseAttachment {
  id: string;
  nome: string;
  tamanho: number;
  conteudo?: string;
}

interface ProcessCase {
  id: string;
  numeroProcesso: string;
  tipoPericia: string;
  origem: string;
  partesEnvolvidas: string;
  dataNomeacao: string;
  valorHonorarios: number;
  status: ProcessStatus;
  observacoes: string;
  anexos: CaseAttachment[];
}

interface CalendarEvent {
  id: string;
  processoId: string | null;
  titulo: string;
  descricao: string;
  local: string;
  data: string;
  prazoEntrega: string | null;
}

interface HonorarioLancamento {
  id: string;
  processoId: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: HonorarioStatus;
  dataRecebimento: string | null;
}

interface TaskComment {
  id: string;
  autorId: string;
  mensagem: string;
  data: string;
}

interface TaskAttachment extends CaseAttachment {
  tarefaId?: string;
}

interface TaskItem {
  id: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  dataInicio: string;
  dataTermino: string;
  status: TaskStatus;
  processoId: string | null;
  comentarios: TaskComment[];
  anexos: TaskAttachment[];
}

interface FinanceEntry {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  status: ExpenseStatus;
  responsavel: string;
  processoId: string | null;
}

interface NotificationItem {
  id: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  data: string;
  processoId?: string | null;
  auto?: boolean;
}

interface SettingsState {
  categoriasDespesa: string[];
  tiposPericia: string[];
  statusProcesso: ProcessStatus[];
}

interface StoredState {
  usuarios: User[];
  processos: ProcessCase[];
  eventos: CalendarEvent[];
  honorarios: HonorarioLancamento[];
  tarefas: TaskItem[];
  financeiro: FinanceEntry[];
  notificacoes: NotificationItem[];
  configuracoes: SettingsState;
}

const STORAGE_KEY = 'gestao_pericial_state_v1';
const SESSION_KEY = 'gestao_pericial_session_v1';

const DEFAULT_SETTINGS: SettingsState = {
  categoriasDespesa: ['Custos de deslocamento', 'Honorários de assistente', 'Hospedagem'],
  tiposPericia: ['Contábil', 'Engenharia', 'Médica', 'Tecnologia'],
  statusProcesso: [
    'aguardando_documento',
    'em_andamento',
    'pericia_agendada',
    'laudo_entregue',
    'concluido',
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  perito: 'Perito',
  assistente: 'Assistente',
};

const PROCESS_STATUS_LABEL: Record<ProcessStatus, string> = {
  aguardando_documento: 'Aguardando documento',
  em_andamento: 'Em andamento',
  pericia_agendada: 'Perícia agendada',
  laudo_entregue: 'Laudo entregue',
  concluido: 'Concluído',
};

const HONORARIO_STATUS_LABEL: Record<HonorarioStatus, string> = {
  previsto: 'Previsto',
  recebido: 'Recebido',
  atrasado: 'Atrasado',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
};

const PREF_KEY: Record<NotificationType, keyof NotificationPreference> = {
  prazo: 'prazos',
  agenda: 'agenda',
  honorario: 'honorarios',
  tarefa: 'tarefas',
};

const BADGE_CLASS_MAP: Record<string, string> = {
  concluido: 'success',
  laudo_entregue: 'success',
  pericia_agendada: 'info',
  aguardando_documento: 'warning',
  em_andamento: 'info',
  previsto: 'info',
  recebido: 'success',
  atrasado: 'danger',
  a_fazer: 'warning',
  em_andamento_tarefa: 'info',
  concluido_tarefa: 'success',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR');
const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseDate(date: string): Date {
  return date ? new Date(date) : new Date();
}

function formatDate(date: string | Date): string {
  if (!date) {
    return '-';
  }
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) {
    return '-';
  }
  return DATE_FORMATTER.format(value);
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value || 0);
}

function differenceInDays(date: string, from: Date = new Date()): number {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }
  const target = parseDate(date);
  const diff = target.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
class CaseManagementApp {
  private state: StoredState;

  private currentUser: User | null = null;

  private activeSection = 'dashboard';

  private dashboardRange = 90;

  private calendarCursor = new Date();

  constructor() {
    this.state = this.loadState();
    this.ensureInitialData();
    this.restoreSession();
    this.render();
  }

  private loadState(): StoredState {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        usuarios: [],
        processos: [],
        eventos: [],
        honorarios: [],
        tarefas: [],
        financeiro: [],
        notificacoes: [],
        configuracoes: DEFAULT_SETTINGS,
      };
    }

    try {
      const parsed = JSON.parse(raw) as StoredState;
      return {
        usuarios: parsed.usuarios ?? [],
        processos: parsed.processos ?? [],
        eventos: parsed.eventos ?? [],
        honorarios: parsed.honorarios ?? [],
        tarefas: parsed.tarefas ?? [],
        financeiro: parsed.financeiro ?? [],
        notificacoes: parsed.notificacoes ?? [],
        configuracoes: {
          categoriasDespesa:
            parsed.configuracoes?.categoriasDespesa ?? DEFAULT_SETTINGS.categoriasDespesa,
          tiposPericia: parsed.configuracoes?.tiposPericia ?? DEFAULT_SETTINGS.tiposPericia,
          statusProcesso: parsed.configuracoes?.statusProcesso ?? DEFAULT_SETTINGS.statusProcesso,
        },
      };
    } catch (error) {
      console.error('Erro ao ler o estado salvo', error);
      return {
        usuarios: [],
        processos: [],
        eventos: [],
        honorarios: [],
        tarefas: [],
        financeiro: [],
        notificacoes: [],
        configuracoes: DEFAULT_SETTINGS,
      };
    }
  }

  private persistState(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.generateNotifications();
  }

  private ensureInitialData(): void {
    if (!this.state.usuarios.length) {
      const admin: User = {
        id: uuid(),
        nome: 'Administrador',
        email: 'admin@pericias.local',
        cpf: '000.000.000-00',
        telefone: '(11) 99999-9999',
        senha: 'admin123',
        perfil: 'admin',
        preferencias: {
          prazos: true,
          agenda: true,
          honorarios: true,
          tarefas: true,
        },
      };
      this.state.usuarios.push(admin);
    }

    if (!this.state.processos.length) {
      this.createSampleData();
    }

    this.persistState();
  }

  private createSampleData(): void {
    const processoId = uuid();
    this.state.processos.push({
      id: processoId,
      numeroProcesso: '0001234-56.2024.8.26.0100',
      tipoPericia: 'Contábil',
      origem: 'TJSP - Vara Cível',
      partesEnvolvidas: 'João Silva x Banco ABC',
      dataNomeacao: new Date().toISOString(),
      valorHonorarios: 8500,
      status: 'pericia_agendada',
      observacoes: 'Solicitar extratos bancários atualizados.',
      anexos: [],
    });

    this.state.eventos.push({
      id: uuid(),
      processoId,
      titulo: 'Perícia contábil',
      descricao: 'Reunião com as partes para coleta de documentos.',
      local: 'Fórum João Mendes',
      data: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      prazoEntrega: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    });

    this.state.honorarios.push({
      id: uuid(),
      processoId,
      descricao: 'Entrada de honorários',
      valor: 4250,
      vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'previsto',
      dataRecebimento: null,
    });

    this.state.tarefas.push({
      id: uuid(),
      titulo: 'Preparar minuta do laudo',
      descricao: 'Compilar documentos e elaborar a minuta inicial.',
      responsavel: 'Administrador',
      dataInicio: new Date().toISOString(),
      dataTermino: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'em_andamento',
      processoId,
      comentarios: [],
      anexos: [],
    });

    this.state.financeiro.push({
      id: uuid(),
      tipo: 'despesa',
      categoria: 'Custos de deslocamento',
      descricao: 'Transporte para perícia',
      valor: 150,
      data: new Date().toISOString(),
      status: 'pago',
      responsavel: 'Administrador',
      processoId,
    });

    this.state.notificacoes.push({
      id: uuid(),
      tipo: 'prazo',
      titulo: 'Prazo de laudo',
      mensagem: 'O processo 0001234 possui entrega prevista em 20 dias.',
      data: new Date().toISOString(),
      processoId,
    });
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      this.currentUser = null;
      return;
    }

    try {
      const session = JSON.parse(raw) as SessionInfo;
      if (session.expiresAt > Date.now()) {
        this.currentUser = this.state.usuarios.find((u) => u.id === session.userId) ?? null;
      } else {
        localStorage.removeItem(SESSION_KEY);
        this.currentUser = null;
      }
    } catch (error) {
      console.error('Erro ao restaurar sessão', error);
      this.currentUser = null;
    }
  }

  private persistSession(user: User | null): void {
    this.currentUser = user;
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      this.render();
      return;
    }

    const session: SessionInfo = {
      userId: user.id,
      expiresAt: Date.now() + 1000 * 60 * 60 * 4,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.render();
  }

  private render(): void {
    const root = document.getElementById('app');
    if (!root) {
      return;
    }

    if (!this.currentUser) {
      root.innerHTML = this.renderAuthLayout();
      this.bindAuthEvents();
      return;
    }

    root.innerHTML = this.renderAppShell();
    this.bindShellEvents();
    this.renderSection(this.activeSection);
  }
  private renderAuthLayout(): string {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Gestão de Casos Periciais</h1>
            <p>Organize processos, agenda, honorários, tarefas e finanças em um só lugar.</p>
          </div>
          <div class="auth-content">
            <div class="tab-buttons" data-auth-tabs>
              <button class="active" data-tab-target="login">Entrar</button>
              <button data-tab-target="register">Registrar</button>
            </div>
            <form id="loginForm" class="form-grid" data-auth-panel="login">
              <div class="form-group">
                <label for="loginEmail">E-mail</label>
                <input type="email" id="loginEmail" required placeholder="usuario@dominio.com" />
              </div>
              <div class="form-group">
                <label for="loginSenha">Senha</label>
                <input type="password" id="loginSenha" required placeholder="********" />
              </div>
              <button type="submit" class="primary-button">Acessar</button>
              <button type="button" class="link-button" id="forgotPasswordButton">Esqueci minha senha</button>
              <p class="error-message" id="loginError" style="display:none"></p>
            </form>
            <form id="registerForm" class="form-grid" data-auth-panel="register" style="display:none">
              <div class="form-group">
                <label for="registerNome">Nome completo</label>
                <input type="text" id="registerNome" required />
              </div>
              <div class="form-group">
                <label for="registerEmail">E-mail</label>
                <input type="email" id="registerEmail" required />
              </div>
              <div class="form-group">
                <label for="registerCpf">CPF</label>
                <input type="text" id="registerCpf" required placeholder="000.000.000-00" />
              </div>
              <div class="form-group">
                <label for="registerTelefone">Telefone</label>
                <input type="tel" id="registerTelefone" required placeholder="(00) 90000-0000" />
              </div>
              <div class="form-group">
                <label for="registerPerfil">Perfil de acesso</label>
                <select id="registerPerfil" required>
                  <option value="perito">Perito</option>
                  <option value="assistente">Assistente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div class="form-group">
                <label for="registerSenha">Senha</label>
                <input type="password" id="registerSenha" required minlength="6" />
              </div>
              <button type="submit" class="primary-button">Criar conta</button>
              <p class="error-message" id="registerError" style="display:none"></p>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  private bindAuthEvents(): void {
    const tabsContainer = document.querySelector('[data-auth-tabs]');
    const tabButtons = tabsContainer?.querySelectorAll('button') ?? [];
    const panels = document.querySelectorAll('[data-auth-panel]');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab-target');
        panels.forEach((panel) => {
          if (panel instanceof HTMLElement) {
            panel.style.display = panel.getAttribute('data-auth-panel') === target ? 'grid' : 'none';
          }
        });
      });
    });

    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
      const senha = (document.getElementById('loginSenha') as HTMLInputElement).value;
      const user = this.state.usuarios.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha,
      );
      const errorEl = document.getElementById('loginError');
      if (!user) {
        if (errorEl) {
          errorEl.textContent = 'Credenciais inválidas. Verifique os dados informados.';
          errorEl.style.display = 'block';
        }
        return;
      }
      if (errorEl) {
        errorEl.style.display = 'none';
      }
      this.persistSession(user);
    });

    const registerForm = document.getElementById('registerForm');
    registerForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const nome = (document.getElementById('registerNome') as HTMLInputElement).value.trim();
      const email = (document.getElementById('registerEmail') as HTMLInputElement).value.trim();
      const cpf = (document.getElementById('registerCpf') as HTMLInputElement).value.trim();
      const telefone = (document.getElementById('registerTelefone') as HTMLInputElement).value.trim();
      const perfil = (document.getElementById('registerPerfil') as HTMLSelectElement).value as Role;
      const senha = (document.getElementById('registerSenha') as HTMLInputElement).value;
      const errorEl = document.getElementById('registerError');

      if (this.state.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        if (errorEl) {
          errorEl.textContent = 'Já existe um usuário cadastrado com este e-mail.';
          errorEl.style.display = 'block';
        }
        return;
      }

      const user: User = {
        id: uuid(),
        nome,
        email,
        cpf,
        telefone,
        senha,
        perfil,
        preferencias: {
          prazos: true,
          agenda: true,
          honorarios: true,
          tarefas: true,
        },
      };

      this.state.usuarios.push(user);
      this.persistState();

      if (errorEl) {
        errorEl.style.display = 'none';
      }

      this.persistSession(user);
    });

    const forgotButton = document.getElementById('forgotPasswordButton');
    forgotButton?.addEventListener('click', () => {
      const email = (document.getElementById('loginEmail') as HTMLInputElement).value.trim();
      const message = email
        ? `Se houver uma conta para ${email}, entraremos em contato para redefinir a senha.`
        : 'Informe seu e-mail no campo de login para receber instruções.';
      alert(message);
    });
  }

  private renderAppShell(): string {
    return `
      <div class="app-shell">
        <aside class="sidebar">
          <div>
            <h2>🗂️ Gestão Pericial</h2>
          </div>
          <nav>
            ${this.renderNavButton('dashboard', 'Dashboard')}
            ${this.renderNavButton('processos', 'Processos')}
            ${this.renderNavButton('agenda', 'Agenda')}
            ${this.renderNavButton('honorarios', 'Honorários')}
            ${this.renderNavButton('tarefas', 'Tarefas')}
            ${this.renderNavButton('financeiro', 'Financeiro')}
            ${this.renderNavButton('notificacoes', 'Notificações')}
            ${this.renderNavButton('configuracoes', 'Configurações')}
          </nav>
          <div class="profile-card">
            <strong>${this.currentUser?.nome ?? ''}</strong>
            <span>${ROLE_LABEL[this.currentUser?.perfil ?? 'assistente']}</span>
            <button id="logoutButton">Sair</button>
          </div>
        </aside>
        <main class="main-panel">
          <section id="section-dashboard" class="section" data-section="dashboard"></section>
          <section id="section-processos" class="section" data-section="processos" style="display:none"></section>
          <section id="section-agenda" class="section" data-section="agenda" style="display:none"></section>
          <section id="section-honorarios" class="section" data-section="honorarios" style="display:none"></section>
          <section id="section-tarefas" class="section" data-section="tarefas" style="display:none"></section>
          <section id="section-financeiro" class="section" data-section="financeiro" style="display:none"></section>
          <section id="section-notificacoes" class="section" data-section="notificacoes" style="display:none"></section>
          <section id="section-configuracoes" class="section" data-section="configuracoes" style="display:none"></section>
        </main>
      </div>
      <div id="modalContainer"></div>
    `;
  }

  private renderNavButton(section: string, label: string): string {
    const active = this.activeSection === section ? 'active' : '';
    return `<button class="${active}" data-nav="${section}">${label}</button>`;
  }

  private bindShellEvents(): void {
    document.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        const section = (button as HTMLElement).getAttribute('data-nav');
        if (!section) {
          return;
        }
        this.activeSection = section;
        document.querySelectorAll('[data-section]').forEach((sectionEl) => {
          if (sectionEl instanceof HTMLElement) {
            sectionEl.style.display = sectionEl.getAttribute('data-section') === section ? 'block' : 'none';
          }
        });
        document.querySelectorAll('[data-nav]').forEach((navBtn) => navBtn.classList.remove('active'));
        button.classList.add('active');
        this.renderSection(section);
      });
    });

    const logoutButton = document.getElementById('logoutButton');
    logoutButton?.addEventListener('click', () => this.persistSession(null));
  }

  private renderSection(section: string): void {
    switch (section) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'processos':
        this.renderProcessos();
        break;
      case 'agenda':
        this.renderAgenda();
        break;
      case 'honorarios':
        this.renderHonorarios();
        break;
      case 'tarefas':
        this.renderTarefas();
        break;
      case 'financeiro':
        this.renderFinanceiro();
        break;
      case 'notificacoes':
        this.renderNotificacoes();
        break;
      case 'configuracoes':
        this.renderConfiguracoes();
        break;
      default:
        break;
    }
  }
  private renderDashboard(): void {
    const container = document.getElementById('section-dashboard');
    if (!container) {
      return;
    }

    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - this.dashboardRange);
    const rangeLabel =
      this.dashboardRange === 30 ? '30 dias' : this.dashboardRange === 90 ? '90 dias' : 'Último ano';

    const upcomingEvents = this.state.eventos.filter((evento) => {
      const diff = differenceInDays(evento.data);
      return diff >= 0 && diff <= 30;
    });

    const honorariosPendentes = this.state.honorarios.filter((h) => h.status !== 'recebido');
    const honorariosRecebidos = this.state.honorarios.filter((h) => h.status === 'recebido');
    const tasksByStatus = {
      pendentes: this.state.tarefas.filter((t) => t.status === 'a_fazer').length,
      andamento: this.state.tarefas.filter((t) => t.status === 'em_andamento').length,
      concluidas: this.state.tarefas.filter((t) => t.status === 'concluido').length,
    };

    container.innerHTML = `
      <h3>Dashboard</h3>
      <p class="section-description">Resumo das métricas principais e próximos compromissos.</p>
      <div class="filters-row">
        <label>Período:</label>
        <select id="dashboardRange">
          <option value="30" ${this.dashboardRange === 30 ? 'selected' : ''}>Últimos 30 dias</option>
          <option value="90" ${this.dashboardRange === 90 ? 'selected' : ''}>Últimos 90 dias</option>
          <option value="365" ${this.dashboardRange === 365 ? 'selected' : ''}>Últimos 12 meses</option>
        </select>
        <span class="tag">${rangeLabel}</span>
      </div>
      <div class="metrics-grid">
        <div class="metric-card">
          <span>Processos cadastrados</span>
          <strong>${this.state.processos.length}</strong>
          <small>${this.state.processos.filter((p) => parseDate(p.dataNomeacao) >= rangeStart).length} no período selecionado</small>
        </div>
        <div class="metric-card">
          <span>Perícias nos próximos 30 dias</span>
          <strong>${upcomingEvents.length}</strong>
          <small>Eventos vinculados à agenda</small>
        </div>
        <div class="metric-card">
          <span>Honorários pendentes</span>
          <strong>${formatCurrency(
            honorariosPendentes.reduce((acc, item) => acc + (item.status !== 'recebido' ? item.valor : 0), 0),
          )}</strong>
          <small>${honorariosPendentes.length} parcelas aguardando pagamento</small>
        </div>
        <div class="metric-card">
          <span>Honorários recebidos</span>
          <strong>${formatCurrency(honorariosRecebidos.reduce((acc, item) => acc + item.valor, 0))}</strong>
          <small>${honorariosRecebidos.length} parcelas quitadas</small>
        </div>
        <div class="metric-card">
          <span>Tarefas</span>
          <strong>${tasksByStatus.pendentes + tasksByStatus.andamento + tasksByStatus.concluidas}</strong>
          <small>${tasksByStatus.pendentes} pendentes · ${tasksByStatus.andamento} em andamento · ${tasksByStatus.concluidas} concluídas</small>
        </div>
      </div>
      <div class="section" style="margin-top:1.5rem">
        <div class="flex-between">
          <h3 style="margin-bottom:0">Compromissos futuros</h3>
          <button class="primary-button" id="openNewEventFromDashboard">Novo evento</button>
        </div>
        <div class="table-wrapper" style="margin-top:1rem">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Título</th>
                <th>Processo</th>
                <th>Local</th>
                <th>Prazo do laudo</th>
              </tr>
            </thead>
            <tbody>
              ${
                upcomingEvents
                  .slice()
                  .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime())
                  .slice(0, 6)
                  .map((evento) => {
                    const processo = this.state.processos.find((p) => p.id === evento.processoId);
                    return `
                      <tr>
                        <td>${formatDate(evento.data)}</td>
                        <td>${evento.titulo}</td>
                        <td>${processo ? processo.numeroProcesso : '-'}</td>
                        <td>${evento.local}</td>
                        <td>${evento.prazoEntrega ? formatDate(evento.prazoEntrega) : '-'}</td>
                      </tr>
                    `;
                  })
                  .join('') || '<tr><td colspan="5">Nenhum compromisso cadastrado.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('dashboardRange')?.addEventListener('change', (event) => {
      const value = Number((event.target as HTMLSelectElement).value);
      this.dashboardRange = value;
      this.renderDashboard();
    });

    document.getElementById('openNewEventFromDashboard')?.addEventListener('click', () =>
      this.openEventModal(),
    );
  }
  private renderProcessos(): void {
    const container = document.getElementById('section-processos');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Processos e demandas técnicas</h3>
          <p class="section-description">Cadastre, filtre e atualize os processos periciais.</p>
        </div>
        <button class="primary-button" id="novoProcessoButton">Novo processo</button>
      </div>
      <form id="filtroProcessos" class="filters-row">
        <select name="status">
          <option value="">Todos os status</option>
          ${this.state.configuracoes.statusProcesso
            .map((status) => `<option value="${status}">${PROCESS_STATUS_LABEL[status]}</option>`)
            .join('')}
        </select>
        <select name="tipo">
          <option value="">Todos os tipos</option>
          ${this.state.configuracoes.tiposPericia
            .map((tipo) => `<option value="${tipo}">${tipo}</option>`)
            .join('')}
        </select>
        <input type="date" name="inicio" />
        <input type="date" name="fim" />
        <button type="submit" class="primary-button">Filtrar</button>
      </form>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nº do processo</th>
              <th>Tipo de perícia</th>
              <th>Data de nomeação</th>
              <th>Status</th>
              <th>Valor de honorários</th>
              <th>Partes envolvidas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="processosTabela"></tbody>
        </table>
      </div>
    `;

    const tabela = document.getElementById('processosTabela');
    const form = document.getElementById('filtroProcessos');

    const renderRows = () => {
      if (!tabela) {
        return;
      }
      const dadosForm = new FormData(form as HTMLFormElement);
      const status = (dadosForm.get('status') as ProcessStatus | '') ?? '';
      const tipo = (dadosForm.get('tipo') as string) ?? '';
      const inicio = dadosForm.get('inicio') as string;
      const fim = dadosForm.get('fim') as string;

      const linhas = this.state.processos
        .filter((processo) => {
          const data = parseDate(processo.dataNomeacao);
          const matchesStatus = status ? processo.status === status : true;
          const matchesTipo = tipo ? processo.tipoPericia === tipo : true;
          const matchesInicio = inicio ? data >= parseDate(inicio) : true;
          const matchesFim = fim ? data <= parseDate(fim) : true;
          return matchesStatus && matchesTipo && matchesInicio && matchesFim;
        })
        .sort((a, b) => parseDate(b.dataNomeacao).getTime() - parseDate(a.dataNomeacao).getTime())
        .map((processo) => {
          const badgeClass = BADGE_CLASS_MAP[processo.status] ?? 'info';
          return `
            <tr data-processo-id="${processo.id}">
              <td>${processo.numeroProcesso}</td>
              <td>${processo.tipoPericia}</td>
              <td>${formatDate(processo.dataNomeacao)}</td>
              <td><span class="badge ${badgeClass}">${PROCESS_STATUS_LABEL[processo.status]}</span></td>
              <td>${formatCurrency(processo.valorHonorarios)}</td>
              <td>${processo.partesEnvolvidas}</td>
              <td class="actions">
                <button data-action="editar">Editar</button>
                <button data-action="excluir">Excluir</button>
              </td>
            </tr>
          `;
        })
        .join('');

      tabela.innerHTML = linhas || '<tr><td colspan="7">Nenhum processo encontrado.</td></tr>';

      tabela.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = (button as HTMLElement).getAttribute('data-action');
          const row = button.closest('tr[data-processo-id]');
          const processoId = row?.getAttribute('data-processo-id');
          if (!processoId) {
            return;
          }
          if (action === 'editar') {
            const processo = this.state.processos.find((p) => p.id === processoId);
            if (processo) {
              this.openProcessModal(processo);
            }
          } else if (action === 'excluir') {
            if (confirm('Deseja realmente excluir este processo?')) {
              this.state.processos = this.state.processos.filter((p) => p.id !== processoId);
              this.state.honorarios = this.state.honorarios.filter((h) => h.processoId !== processoId);
              this.state.eventos = this.state.eventos.filter((e) => e.processoId !== processoId);
              this.state.tarefas = this.state.tarefas.map((t) => ({
                ...t,
                processoId: t.processoId === processoId ? null : t.processoId,
              }));
              this.persistState();
              renderRows();
              this.renderDashboard();
            }
          }
        });
      });
    };

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      renderRows();
    });

    renderRows();

    document.getElementById('novoProcessoButton')?.addEventListener('click', () => this.openProcessModal());
  }
  private openProcessModal(processo?: ProcessCase): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const isEdit = Boolean(processo);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>${isEdit ? 'Editar processo' : 'Novo processo'}</h4>
            <button id="closeModal">×</button>
          </header>
          <form id="processoForm" class="form-grid">
            <div class="form-group">
              <label>Número do processo</label>
              <input type="text" name="numeroProcesso" required value="${processo?.numeroProcesso ?? ''}" />
            </div>
            <div class="form-group">
              <label>Tipo de perícia</label>
              <select name="tipoPericia" required>
                ${this.state.configuracoes.tiposPericia
                  .map(
                    (tipo) =>
                      `<option value="${tipo}" ${processo?.tipoPericia === tipo ? 'selected' : ''}>${tipo}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Tribunal / Origem</label>
              <input type="text" name="origem" required value="${processo?.origem ?? ''}" />
            </div>
            <div class="form-group">
              <label>Partes envolvidas</label>
              <textarea name="partesEnvolvidas" rows="3" required>${processo?.partesEnvolvidas ?? ''}</textarea>
            </div>
            <div class="form-group">
              <label>Data de nomeação</label>
              <input type="date" name="dataNomeacao" required value="${
                processo ? processo.dataNomeacao.slice(0, 10) : ''
              }" />
            </div>
            <div class="form-group">
              <label>Valor de honorários</label>
              <input type="number" name="valorHonorarios" min="0" step="0.01" required value="${
                processo?.valorHonorarios ?? ''
              }" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                ${this.state.configuracoes.statusProcesso
                  .map(
                    (status) =>
                      `<option value="${status}" ${processo?.status === status ? 'selected' : ''}>${
                        PROCESS_STATUS_LABEL[status]
                      }</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Observações</label>
              <textarea name="observacoes" rows="3">${processo?.observacoes ?? ''}</textarea>
            </div>
            <div class="form-group">
              <label>Anexos (${processo?.anexos.length ?? 0} atuais)</label>
              <input type="file" name="anexos" multiple accept="application/pdf,image/*" />
              ${
                processo?.anexos?.length
                  ? `<div class="list" style="margin-top:0.5rem">${processo.anexos
                      .map((anexo) => `<span class="tag">${anexo.nome}</span>`)
                      .join('')}</div>`
                  : ''
              }
            </div>
          </form>
          <footer>
            <button class="primary-button" id="salvarProcesso">Salvar</button>
            <button id="cancelarProcesso">Cancelar</button>
          </footer>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelarProcesso')?.addEventListener('click', closeModal);

    document.getElementById('salvarProcesso')?.addEventListener('click', async () => {
      const form = document.getElementById('processoForm') as HTMLFormElement;
      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      const anexosInput = form.querySelector('input[name="anexos"]') as HTMLInputElement;
      const novosAnexos = await this.readAttachments(anexosInput?.files ?? null);

      const updated: ProcessCase = {
        id: processo?.id ?? uuid(),
        numeroProcesso: String(formData.get('numeroProcesso') ?? ''),
        tipoPericia: formData.get('tipoPericia') as string,
        origem: String(formData.get('origem') ?? ''),
        partesEnvolvidas: String(formData.get('partesEnvolvidas') ?? ''),
        dataNomeacao: new Date(String(formData.get('dataNomeacao') ?? new Date().toISOString())).toISOString(),
        valorHonorarios: Number(formData.get('valorHonorarios') ?? 0),
        status: formData.get('status') as ProcessStatus,
        observacoes: String(formData.get('observacoes') ?? ''),
        anexos: processo ? [...processo.anexos, ...novosAnexos] : novosAnexos,
      };

      if (processo) {
        this.state.processos = this.state.processos.map((item) => (item.id === processo.id ? updated : item));
      } else {
        this.state.processos.push(updated);
      }

      this.persistState();
      closeModal();
      this.renderProcessos();
      this.renderDashboard();
    });
  }

  private async readAttachments(fileList: FileList | null): Promise<CaseAttachment[]> {
    if (!fileList || !fileList.length) {
      return [];
    }

    const promises: Promise<CaseAttachment>[] = Array.from(fileList).map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: uuid(),
            nome: file.name,
            tamanho: file.size,
            conteudo: typeof reader.result === 'string' ? reader.result : undefined,
          });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });

    return Promise.all(promises);
  }
  private renderAgenda(): void {
    const container = document.getElementById('section-agenda');
    if (!container) {
      return;
    }

    const monthLabel = this.calendarCursor.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });

    const startOfMonth = new Date(this.calendarCursor.getFullYear(), this.calendarCursor.getMonth(), 1);
    const startDay = startOfMonth.getDay();
    const gridStart = new Date(startOfMonth);
    gridStart.setDate(startOfMonth.getDate() - ((startDay + 6) % 7));

    const cells: string[] = [];
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + i);
      const eventsOnDay = this.state.eventos.filter((evento) => {
        const eventDate = parseDate(evento.data);
        return (
          eventDate.getFullYear() === current.getFullYear() &&
          eventDate.getMonth() === current.getMonth() &&
          eventDate.getDate() === current.getDate()
        );
      });
      const isCurrentMonth = current.getMonth() === this.calendarCursor.getMonth();
      cells.push(`
        <div class="calendar-cell" data-date="${current.toISOString()}">
          <strong style="opacity:${isCurrentMonth ? 1 : 0.4}">${current.getDate()}</strong>
          ${eventsOnDay
            .map((evento) => `<div class="calendar-event" data-evento-id="${evento.id}">${evento.titulo}</div>`)
            .join('')}
        </div>
      `);
    }

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Agenda e compromissos</h3>
          <p class="section-description">Visualização mensal de perícias, prazos e atividades programadas.</p>
        </div>
        <button class="primary-button" id="novoEventoButton">Novo evento</button>
      </div>
      <div class="flex-between">
        <div class="inline-form">
          <button id="prevMonth">◀</button>
          <strong>${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
          <button id="nextMonth">▶</button>
        </div>
        <div class="inline-form">
          <input type="date" id="agendaFiltroData" />
          <button id="agendaFiltrar" class="primary-button">Filtrar</button>
        </div>
      </div>
      <div class="calendar-grid">${cells.join('')}</div>
      <div class="section" style="margin-top:1.5rem">
        <h3 style="margin-bottom:0.5rem">Eventos cadastrados</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Título</th>
                <th>Processo</th>
                <th>Local</th>
                <th>Prazo de entrega</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="agendaTabela"></tbody>
          </table>
        </div>
      </div>
    `;

    const renderListaEventos = (filtroData?: string) => {
      const tabela = document.getElementById('agendaTabela');
      if (!tabela) {
        return;
      }
      const eventos = this.state.eventos
        .filter((evento) => {
          if (!filtroData) {
            return true;
          }
          return evento.data.slice(0, 10) === filtroData;
        })
        .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());

      tabela.innerHTML =
        eventos
          .map((evento) => {
            const processo = this.state.processos.find((p) => p.id === evento.processoId);
            return `
              <tr data-evento-id="${evento.id}">
                <td>${formatDate(evento.data)}</td>
                <td>${evento.titulo}</td>
                <td>${processo ? processo.numeroProcesso : '-'}</td>
                <td>${evento.local}</td>
                <td>${evento.prazoEntrega ? formatDate(evento.prazoEntrega) : '-'}</td>
                <td class="actions">
                  <button data-action="editar">Editar</button>
                  <button data-action="excluir">Excluir</button>
                </td>
              </tr>
            `;
          })
          .join('') || '<tr><td colspan="6">Nenhum evento cadastrado.</td></tr>';

      tabela.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = (button as HTMLElement).getAttribute('data-action');
          const row = button.closest('tr[data-evento-id]');
          const eventoId = row?.getAttribute('data-evento-id');
          if (!eventoId) {
            return;
          }
          if (action === 'editar') {
            const evento = this.state.eventos.find((e) => e.id === eventoId);
            if (evento) {
              this.openEventModal(evento);
            }
          } else if (action === 'excluir') {
            if (confirm('Deseja excluir este evento da agenda?')) {
              this.state.eventos = this.state.eventos.filter((e) => e.id !== eventoId);
              this.persistState();
              this.renderAgenda();
            }
          }
        });
      });
    };

    renderListaEventos();

    document.getElementById('agendaFiltrar')?.addEventListener('click', () => {
      const filtroData = (document.getElementById('agendaFiltroData') as HTMLInputElement).value;
      renderListaEventos(filtroData || undefined);
    });

    document.getElementById('prevMonth')?.addEventListener('click', () => {
      this.calendarCursor = new Date(
        this.calendarCursor.getFullYear(),
        this.calendarCursor.getMonth() - 1,
        1,
      );
      this.renderAgenda();
    });

    document.getElementById('nextMonth')?.addEventListener('click', () => {
      this.calendarCursor = new Date(
        this.calendarCursor.getFullYear(),
        this.calendarCursor.getMonth() + 1,
        1,
      );
      this.renderAgenda();
    });

    document.getElementById('novoEventoButton')?.addEventListener('click', () => this.openEventModal());
  }
  private openEventModal(evento?: CalendarEvent): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const isEdit = Boolean(evento);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>${isEdit ? 'Editar evento' : 'Novo evento'}</h4>
            <button id="closeModal">×</button>
          </header>
          <form id="eventoForm" class="form-grid">
            <div class="form-group">
              <label>Título</label>
              <input type="text" name="titulo" required value="${evento?.titulo ?? ''}" />
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <textarea name="descricao" rows="3">${evento?.descricao ?? ''}</textarea>
            </div>
            <div class="form-group">
              <label>Processo vinculado</label>
              <select name="processoId">
                <option value="">Sem vínculo</option>
                ${this.state.processos
                  .map(
                    (processo) =>
                      `<option value="${processo.id}" ${evento?.processoId === processo.id ? 'selected' : ''}>${
                        processo.numeroProcesso
                      }</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Local</label>
              <input type="text" name="local" required value="${evento?.local ?? ''}" />
            </div>
            <div class="form-group">
              <label>Data e hora</label>
              <input type="datetime-local" name="data" required value="${
                evento ? evento.data.slice(0, 16) : ''
              }" />
            </div>
            <div class="form-group">
              <label>Prazo para entrega de laudo</label>
              <input type="date" name="prazoEntrega" value="${evento?.prazoEntrega?.slice(0, 10) ?? ''}" />
            </div>
          </form>
          <footer>
            <button class="primary-button" id="salvarEvento">Salvar</button>
            <button id="cancelarEvento">Cancelar</button>
          </footer>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelarEvento')?.addEventListener('click', closeModal);

    document.getElementById('salvarEvento')?.addEventListener('click', () => {
      const form = document.getElementById('eventoForm') as HTMLFormElement;
      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      const updated: CalendarEvent = {
        id: evento?.id ?? uuid(),
        titulo: String(formData.get('titulo') ?? ''),
        descricao: String(formData.get('descricao') ?? ''),
        processoId: (formData.get('processoId') as string) || null,
        local: String(formData.get('local') ?? ''),
        data: new Date(String(formData.get('data') ?? new Date().toISOString())).toISOString(),
        prazoEntrega: formData.get('prazoEntrega')
          ? new Date(String(formData.get('prazoEntrega'))).toISOString()
          : null,
      };

      if (evento) {
        this.state.eventos = this.state.eventos.map((item) => (item.id === evento.id ? updated : item));
      } else {
        this.state.eventos.push(updated);
      }

      this.persistState();
      closeModal();
      this.renderAgenda();
      this.renderDashboard();
    });
  }
  private renderHonorarios(): void {
    const container = document.getElementById('section-honorarios');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Controle de honorários</h3>
          <p class="section-description">Registre parcelas, acompanhe vencimentos e gere relatórios por status.</p>
        </div>
        <button class="primary-button" id="novoHonorarioButton">Novo lançamento</button>
      </div>
      <form id="filtroHonorarios" class="filters-row">
        <select name="status">
          <option value="">Todos os status</option>
          <option value="previsto">Previsto</option>
          <option value="recebido">Recebido</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <input type="date" name="inicio" />
        <input type="date" name="fim" />
        <button type="submit" class="primary-button">Filtrar</button>
      </form>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Processo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="honorariosTabela"></tbody>
        </table>
      </div>
      <div class="metrics-grid" style="margin-top:1.5rem">
        <div class="metric-card">
          <span>Total previsto</span>
          <strong>${formatCurrency(
            this.state.honorarios.filter((h) => h.status !== 'recebido').reduce((acc, item) => acc + item.valor, 0),
          )}</strong>
        </div>
        <div class="metric-card">
          <span>Total recebido</span>
          <strong>${formatCurrency(
            this.state.honorarios.filter((h) => h.status === 'recebido').reduce((acc, item) => acc + item.valor, 0),
          )}</strong>
        </div>
      </div>
    `;

    const tabela = document.getElementById('honorariosTabela');
    const form = document.getElementById('filtroHonorarios');

    const renderRows = () => {
      if (!tabela) {
        return;
      }
      const dadosForm = new FormData(form as HTMLFormElement);
      const status = (dadosForm.get('status') as HonorarioStatus | '') ?? '';
      const inicio = dadosForm.get('inicio') as string;
      const fim = dadosForm.get('fim') as string;

      const linhas = this.state.honorarios
        .filter((item) => {
          const matchesStatus = status ? item.status === status : true;
          const data = parseDate(item.vencimento);
          const matchesInicio = inicio ? data >= parseDate(inicio) : true;
          const matchesFim = fim ? data <= parseDate(fim) : true;
          return matchesStatus && matchesInicio && matchesFim;
        })
        .sort((a, b) => parseDate(a.vencimento).getTime() - parseDate(b.vencimento).getTime())
        .map((item) => {
          const processo = this.state.processos.find((p) => p.id === item.processoId);
          const badgeClass = BADGE_CLASS_MAP[item.status] ?? 'info';
          return `
            <tr data-honorario-id="${item.id}">
              <td>${processo ? processo.numeroProcesso : '-'}</td>
              <td>${item.descricao}</td>
              <td>${formatCurrency(item.valor)}</td>
              <td>${formatDate(item.vencimento)}</td>
              <td><span class="badge ${badgeClass}">${HONORARIO_STATUS_LABEL[item.status]}</span></td>
              <td class="actions">
                <button data-action="editar">Editar</button>
                <button data-action="excluir">Excluir</button>
              </td>
            </tr>
          `;
        })
        .join('');

      tabela.innerHTML = linhas || '<tr><td colspan="6">Nenhum lançamento encontrado.</td></tr>';

      tabela.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = (button as HTMLElement).getAttribute('data-action');
          const row = button.closest('tr[data-honorario-id]');
          const id = row?.getAttribute('data-honorario-id');
          if (!id) {
            return;
          }
          if (action === 'editar') {
            const item = this.state.honorarios.find((h) => h.id === id);
            if (item) {
              this.openHonorarioModal(item);
            }
          } else if (action === 'excluir') {
            if (confirm('Deseja excluir este lançamento de honorários?')) {
              this.state.honorarios = this.state.honorarios.filter((h) => h.id !== id);
              this.persistState();
              renderRows();
              this.renderDashboard();
            }
          }
        });
      });
    };

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      renderRows();
    });

    renderRows();

    document.getElementById('novoHonorarioButton')?.addEventListener('click', () => this.openHonorarioModal());
  }

  private openHonorarioModal(item?: HonorarioLancamento): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const isEdit = Boolean(item);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>${isEdit ? 'Editar honorário' : 'Novo honorário'}</h4>
            <button id="closeModal">×</button>
          </header>
          <form id="honorarioForm" class="form-grid">
            <div class="form-group">
              <label>Processo</label>
              <select name="processoId" required>
                ${this.state.processos
                  .map(
                    (processo) =>
                      `<option value="${processo.id}" ${item?.processoId === processo.id ? 'selected' : ''}>${
                        processo.numeroProcesso
                      }</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <input type="text" name="descricao" required value="${item?.descricao ?? ''}" />
            </div>
            <div class="form-group">
              <label>Valor</label>
              <input type="number" name="valor" min="0" step="0.01" required value="${item?.valor ?? ''}" />
            </div>
            <div class="form-group">
              <label>Data de vencimento</label>
              <input type="date" name="vencimento" required value="${item ? item.vencimento.slice(0, 10) : ''}" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status" required>
                <option value="previsto" ${item?.status === 'previsto' ? 'selected' : ''}>Previsto</option>
                <option value="recebido" ${item?.status === 'recebido' ? 'selected' : ''}>Recebido</option>
                <option value="atrasado" ${item?.status === 'atrasado' ? 'selected' : ''}>Atrasado</option>
              </select>
            </div>
            <div class="form-group">
              <label>Data de recebimento</label>
              <input type="date" name="dataRecebimento" value="${item?.dataRecebimento?.slice(0, 10) ?? ''}" />
            </div>
          </form>
          <footer>
            <button class="primary-button" id="salvarHonorario">Salvar</button>
            <button id="cancelarHonorario">Cancelar</button>
          </footer>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelarHonorario')?.addEventListener('click', closeModal);

    document.getElementById('salvarHonorario')?.addEventListener('click', () => {
      const form = document.getElementById('honorarioForm') as HTMLFormElement;
      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      const updated: HonorarioLancamento = {
        id: item?.id ?? uuid(),
        processoId: formData.get('processoId') as string,
        descricao: String(formData.get('descricao') ?? ''),
        valor: Number(formData.get('valor') ?? 0),
        vencimento: new Date(String(formData.get('vencimento') ?? new Date().toISOString())).toISOString(),
        status: formData.get('status') as HonorarioStatus,
        dataRecebimento: formData.get('dataRecebimento')
          ? new Date(String(formData.get('dataRecebimento'))).toISOString()
          : null,
      };

      if (item) {
        this.state.honorarios = this.state.honorarios.map((h) => (h.id === item.id ? updated : h));
      } else {
        this.state.honorarios.push(updated);
      }

      this.persistState();
      closeModal();
      this.renderHonorarios();
      this.renderDashboard();
    });
  }
  private renderTarefas(): void {
    const container = document.getElementById('section-tarefas');
    if (!container) {
      return;
    }

    const grouped: Record<TaskStatus, TaskItem[]> = {
      a_fazer: [],
      em_andamento: [],
      concluido: [],
    };
    this.state.tarefas.forEach((tarefa) => {
      grouped[tarefa.status].push(tarefa);
    });

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Gestão de tarefas (Kanban)</h3>
          <p class="section-description">Organize atividades por status, registre comentários e acompanhe responsáveis.</p>
        </div>
        <button class="primary-button" id="novaTarefaButton">Nova tarefa</button>
      </div>
      <div class="kanban-board">
        ${(['a_fazer', 'em_andamento', 'concluido'] as TaskStatus[])
          .map((status) => {
            const titulo = TASK_STATUS_LABEL[status];
            return `
              <div class="kanban-column" data-status="${status}">
                <div class="flex-between">
                  <h4>${titulo}</h4>
                  <span class="tag">${grouped[status].length}</span>
                </div>
                <div class="stack">
                  ${
                    grouped[status]
                      .map((tarefa) => {
                        const processo = this.state.processos.find((p) => p.id === tarefa.processoId);
                        const daysToDue = differenceInDays(tarefa.dataTermino);
                        const badgeClass =
                          tarefa.status === 'concluido'
                            ? BADGE_CLASS_MAP['concluido_tarefa']
                            : tarefa.status === 'em_andamento'
                            ? BADGE_CLASS_MAP['em_andamento_tarefa']
                            : BADGE_CLASS_MAP['a_fazer'];
                        return `
                          <article class="task-card" data-tarefa-id="${tarefa.id}">
                            <div class="flex-between">
                              <strong>${tarefa.titulo}</strong>
                              <span class="badge ${badgeClass}">${TASK_STATUS_LABEL[tarefa.status]}</span>
                            </div>
                            <p>${tarefa.descricao}</p>
                            <div class="flex-between">
                              <span class="tag">Resp.: ${tarefa.responsavel}</span>
                              <span class="tag">${daysToDue === Number.POSITIVE_INFINITY ? '-' : `${daysToDue} dias`}</span>
                            </div>
                            <div class="stack">
                              <small>${processo ? `Processo: ${processo.numeroProcesso}` : 'Tarefa geral'}</small>
                              <div class="actions">
                                <button data-action="editar">Editar</button>
                                <button data-action="mover">Mover</button>
                                <button data-action="detalhes">Detalhes</button>
                              </div>
                            </div>
                          </article>
                        `;
                      })
                      .join('') || '<p>Nenhuma tarefa nesta coluna.</p>'
                  }
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    container.querySelectorAll('[data-action="editar"]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-tarefa-id]');
        const tarefaId = card?.getAttribute('data-tarefa-id');
        const tarefa = this.state.tarefas.find((t) => t.id === tarefaId);
        if (tarefa) {
          this.openTarefaModal(tarefa);
        }
      });
    });

    container.querySelectorAll('[data-action="mover"]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-tarefa-id]');
        const tarefaId = card?.getAttribute('data-tarefa-id');
        const tarefa = this.state.tarefas.find((t) => t.id === tarefaId);
        if (!tarefa) {
          return;
        }
        const nextStatus: Record<TaskStatus, TaskStatus> = {
          a_fazer: 'em_andamento',
          em_andamento: 'concluido',
          concluido: 'a_fazer',
        };
        tarefa.status = nextStatus[tarefa.status];
        this.persistState();
        this.renderTarefas();
        this.renderDashboard();
      });
    });

    container.querySelectorAll('[data-action="detalhes"]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('[data-tarefa-id]');
        const tarefaId = card?.getAttribute('data-tarefa-id');
        const tarefa = this.state.tarefas.find((t) => t.id === tarefaId);
        if (tarefa) {
          this.openDetalheTarefaModal(tarefa);
        }
      });
    });

    document.getElementById('novaTarefaButton')?.addEventListener('click', () => this.openTarefaModal());
  }

  private openTarefaModal(tarefa?: TaskItem): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const isEdit = Boolean(tarefa);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>${isEdit ? 'Editar tarefa' : 'Nova tarefa'}</h4>
            <button id="closeModal">×</button>
          </header>
          <form id="tarefaForm" class="form-grid">
            <div class="form-group">
              <label>Título</label>
              <input type="text" name="titulo" required value="${tarefa?.titulo ?? ''}" />
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <textarea name="descricao" rows="3" required>${tarefa?.descricao ?? ''}</textarea>
            </div>
            <div class="form-group">
              <label>Responsável</label>
              <input type="text" name="responsavel" required value="${tarefa?.responsavel ?? ''}" />
            </div>
            <div class="form-group">
              <label>Processo vinculado</label>
              <select name="processoId">
                <option value="">Sem vínculo</option>
                ${this.state.processos
                  .map(
                    (processo) =>
                      `<option value="${processo.id}" ${tarefa?.processoId === processo.id ? 'selected' : ''}>${
                        processo.numeroProcesso
                      }</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Data de início</label>
              <input type="date" name="dataInicio" required value="${
                tarefa ? tarefa.dataInicio.slice(0, 10) : ''
              }" />
            </div>
            <div class="form-group">
              <label>Data de término</label>
              <input type="date" name="dataTermino" required value="${
                tarefa ? tarefa.dataTermino.slice(0, 10) : ''
              }" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                <option value="a_fazer" ${tarefa?.status === 'a_fazer' ? 'selected' : ''}>A fazer</option>
                <option value="em_andamento" ${tarefa?.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="concluido" ${tarefa?.status === 'concluido' ? 'selected' : ''}>Concluído</option>
              </select>
            </div>
            <div class="form-group">
              <label>Anexos (${tarefa?.anexos.length ?? 0} atuais)</label>
              <input type="file" name="anexos" multiple accept="application/pdf,image/*" />
              ${
                tarefa?.anexos?.length
                  ? `<div class="list" style="margin-top:0.5rem">${tarefa.anexos
                      .map((anexo) => `<span class="tag">${anexo.nome}</span>`)
                      .join('')}</div>`
                  : ''
              }
            </div>
          </form>
          <footer>
            <button class="primary-button" id="salvarTarefa">Salvar</button>
            <button id="cancelarTarefa">Cancelar</button>
          </footer>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelarTarefa')?.addEventListener('click', closeModal);

    document.getElementById('salvarTarefa')?.addEventListener('click', async () => {
      const form = document.getElementById('tarefaForm') as HTMLFormElement;
      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      const anexosInput = form.querySelector('input[name="anexos"]') as HTMLInputElement;
      const novosAnexos = await this.readAttachments(anexosInput?.files ?? null);

      const updated: TaskItem = {
        id: tarefa?.id ?? uuid(),
        titulo: String(formData.get('titulo') ?? ''),
        descricao: String(formData.get('descricao') ?? ''),
        responsavel: String(formData.get('responsavel') ?? ''),
        processoId: (formData.get('processoId') as string) || null,
        dataInicio: new Date(String(formData.get('dataInicio') ?? new Date().toISOString())).toISOString(),
        dataTermino: new Date(String(formData.get('dataTermino') ?? new Date().toISOString())).toISOString(),
        status: formData.get('status') as TaskStatus,
        comentarios: tarefa ? tarefa.comentarios : [],
        anexos: tarefa ? [...tarefa.anexos, ...novosAnexos] : novosAnexos,
      };

      if (tarefa) {
        this.state.tarefas = this.state.tarefas.map((item) => (item.id === tarefa.id ? updated : item));
      } else {
        this.state.tarefas.push(updated);
      }

      this.persistState();
      closeModal();
      this.renderTarefas();
      this.renderDashboard();
    });
  }

  private openDetalheTarefaModal(tarefa: TaskItem): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const processo = this.state.processos.find((p) => p.id === tarefa.processoId);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>Detalhes da tarefa</h4>
            <button id="closeModal">×</button>
          </header>
          <div class="stack">
            <strong>${tarefa.titulo}</strong>
            <p>${tarefa.descricao}</p>
            <div class="tag">Responsável: ${tarefa.responsavel}</div>
            <div class="tag">Status: ${TASK_STATUS_LABEL[tarefa.status]}</div>
            <div class="tag">Período: ${formatDate(tarefa.dataInicio)} - ${formatDate(tarefa.dataTermino)}</div>
            <div class="tag">${processo ? `Processo: ${processo.numeroProcesso}` : 'Tarefa geral'}</div>
            <div>
              <h4>Anexos</h4>
              ${
                tarefa.anexos.length
                  ? `<div class="list">${tarefa.anexos
                      .map(
                        (anexo) =>
                          `<a href="${anexo.conteudo ?? ''}" download="${anexo.nome}" class="tag" target="_blank">${
                            anexo.nome
                          }</a>`,
                      )
                      .join('')}</div>`
                  : '<p>Nenhum anexo cadastrado.</p>'
              }
            </div>
            <div>
              <h4>Comentários</h4>
              <div class="list" id="comentariosLista">
                ${
                  tarefa.comentarios.length
                    ? tarefa.comentarios
                        .map((comentario) => {
                          const autor = this.state.usuarios.find((u) => u.id === comentario.autorId);
                          return `
                            <div class="notification-card">
                              <strong>${autor ? autor.nome : 'Usuário'}</strong>
                              <small>${formatDate(comentario.data)}</small>
                              <p>${comentario.mensagem}</p>
                            </div>
                          `;
                        })
                        .join('')
                    : '<p>Nenhum comentário registrado.</p>'
                }
              </div>
              <form id="comentarioForm" class="form-grid" style="margin-top:1rem">
                <div class="form-group">
                  <label>Adicionar comentário</label>
                  <textarea name="comentario" rows="3" required></textarea>
                </div>
                <button type="submit" class="primary-button">Registrar comentário</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);

    document.getElementById('comentarioForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const textarea = (event.target as HTMLFormElement).querySelector('textarea');
      const mensagem = textarea?.value.trim();
      if (!mensagem) {
        return;
      }
      tarefa.comentarios.push({
        id: uuid(),
        autorId: this.currentUser?.id ?? '',
        mensagem,
        data: new Date().toISOString(),
      });
      this.persistState();
      this.renderTarefas();
      this.renderDashboard();
      this.openDetalheTarefaModal(tarefa);
    });
  }
  private renderFinanceiro(): void {
    const container = document.getElementById('section-financeiro');
    if (!container) {
      return;
    }

    const receitas = this.state.financeiro.filter((item) => item.tipo === 'receita');
    const despesas = this.state.financeiro.filter((item) => item.tipo === 'despesa');
    const saldo = receitas.reduce((acc, item) => acc + item.valor, 0) - despesas.reduce((acc, item) => acc + item.valor, 0);

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Fluxo financeiro</h3>
          <p class="section-description">Registre receitas e despesas, categorize lançamentos e acompanhe o fluxo de caixa.</p>
        </div>
        <button class="primary-button" id="novoLancamentoFinanceiro">Novo lançamento</button>
      </div>
      <form id="filtroFinanceiro" class="filters-row">
        <select name="tipo">
          <option value="">Todos os tipos</option>
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>
        <select name="status">
          <option value="">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="nao_pago">Não pago</option>
        </select>
        <input type="date" name="inicio" />
        <input type="date" name="fim" />
        <button type="submit" class="primary-button">Filtrar</button>
      </form>
      <div class="metrics-grid">
        <div class="metric-card">
          <span>Total de receitas</span>
          <strong>${formatCurrency(receitas.reduce((acc, item) => acc + item.valor, 0))}</strong>
        </div>
        <div class="metric-card">
          <span>Total de despesas</span>
          <strong>${formatCurrency(despesas.reduce((acc, item) => acc + item.valor, 0))}</strong>
        </div>
        <div class="metric-card">
          <span>Saldo</span>
          <strong>${formatCurrency(saldo)}</strong>
        </div>
      </div>
      <div class="table-wrapper" style="margin-top:1.5rem">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Processo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="financeiroTabela"></tbody>
        </table>
      </div>
    `;

    const tabela = document.getElementById('financeiroTabela');
    const form = document.getElementById('filtroFinanceiro');

    const renderRows = () => {
      if (!tabela) {
        return;
      }
      const dadosForm = new FormData(form as HTMLFormElement);
      const tipo = (dadosForm.get('tipo') as 'receita' | 'despesa' | '') ?? '';
      const status = (dadosForm.get('status') as ExpenseStatus | '') ?? '';
      const inicio = dadosForm.get('inicio') as string;
      const fim = dadosForm.get('fim') as string;

      const linhas = this.state.financeiro
        .filter((item) => {
          const matchesTipo = tipo ? item.tipo === tipo : true;
          const matchesStatus = status ? item.status === status : true;
          const data = parseDate(item.data);
          const matchesInicio = inicio ? data >= parseDate(inicio) : true;
          const matchesFim = fim ? data <= parseDate(fim) : true;
          return matchesTipo && matchesStatus && matchesInicio && matchesFim;
        })
        .sort((a, b) => parseDate(b.data).getTime() - parseDate(a.data).getTime())
        .map((item) => {
          const processo = this.state.processos.find((p) => p.id === item.processoId);
          const badgeClass = item.tipo === 'receita' ? 'success' : 'danger';
          return `
            <tr data-financeiro-id="${item.id}">
              <td>${formatDate(item.data)}</td>
              <td><span class="badge ${badgeClass}">${item.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td>
              <td>${item.categoria}</td>
              <td>${item.descricao}</td>
              <td>${formatCurrency(item.valor)}</td>
              <td>${item.status === 'pago' ? 'Pago' : 'Não pago'}</td>
              <td>${item.responsavel}</td>
              <td>${processo ? processo.numeroProcesso : '-'}</td>
              <td class="actions">
                <button data-action="editar">Editar</button>
                <button data-action="excluir">Excluir</button>
              </td>
            </tr>
          `;
        })
        .join('');

      tabela.innerHTML = linhas || '<tr><td colspan="9">Nenhum lançamento encontrado.</td></tr>';

      tabela.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = (button as HTMLElement).getAttribute('data-action');
          const row = button.closest('tr[data-financeiro-id]');
          const id = row?.getAttribute('data-financeiro-id');
          if (!id) {
            return;
          }
          if (action === 'editar') {
            const item = this.state.financeiro.find((f) => f.id === id);
            if (item) {
              this.openFinanceiroModal(item);
            }
          } else if (action === 'excluir') {
            if (confirm('Deseja excluir este lançamento financeiro?')) {
              this.state.financeiro = this.state.financeiro.filter((f) => f.id !== id);
              this.persistState();
              renderRows();
            }
          }
        });
      });
    };

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      renderRows();
    });

    renderRows();

    document
      .getElementById('novoLancamentoFinanceiro')
      ?.addEventListener('click', () => this.openFinanceiroModal());
  }

  private openFinanceiroModal(item?: FinanceEntry): void {
    const container = document.getElementById('modalContainer');
    if (!container) {
      return;
    }

    const isEdit = Boolean(item);

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <header>
            <h4>${isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h4>
            <button id="closeModal">×</button>
          </header>
          <form id="financeiroForm" class="form-grid">
            <div class="form-group">
              <label>Tipo</label>
              <select name="tipo" required>
                <option value="receita" ${item?.tipo === 'receita' ? 'selected' : ''}>Receita</option>
                <option value="despesa" ${item?.tipo === 'despesa' ? 'selected' : ''}>Despesa</option>
              </select>
            </div>
            <div class="form-group">
              <label>Categoria</label>
              <select name="categoria" required>
                ${this.state.configuracoes.categoriasDespesa
                  .map((categoria) => `<option value="${categoria}" ${item?.categoria === categoria ? 'selected' : ''}>${categoria}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <input type="text" name="descricao" required value="${item?.descricao ?? ''}" />
            </div>
            <div class="form-group">
              <label>Valor</label>
              <input type="number" name="valor" min="0" step="0.01" required value="${item?.valor ?? ''}" />
            </div>
            <div class="form-group">
              <label>Data</label>
              <input type="date" name="data" required value="${item ? item.data.slice(0, 10) : ''}" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status" required>
                <option value="pago" ${item?.status === 'pago' ? 'selected' : ''}>Pago</option>
                <option value="nao_pago" ${item?.status === 'nao_pago' ? 'selected' : ''}>Não pago</option>
              </select>
            </div>
            <div class="form-group">
              <label>Responsável</label>
              <input type="text" name="responsavel" required value="${item?.responsavel ?? this.currentUser?.nome ?? ''}" />
            </div>
            <div class="form-group">
              <label>Processo vinculado</label>
              <select name="processoId">
                <option value="">Sem vínculo</option>
                ${this.state.processos
                  .map(
                    (processo) =>
                      `<option value="${processo.id}" ${item?.processoId === processo.id ? 'selected' : ''}>${
                        processo.numeroProcesso
                      }</option>`,
                  )
                  .join('')}
              </select>
            </div>
          </form>
          <footer>
            <button class="primary-button" id="salvarFinanceiro">Salvar</button>
            <button id="cancelarFinanceiro">Cancelar</button>
          </footer>
        </div>
      </div>
    `;

    const closeModal = () => {
      container.innerHTML = '';
    };

    document.getElementById('closeModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelarFinanceiro')?.addEventListener('click', closeModal);

    document.getElementById('salvarFinanceiro')?.addEventListener('click', () => {
      const form = document.getElementById('financeiroForm') as HTMLFormElement;
      if (!form.reportValidity()) {
        return;
      }
      const formData = new FormData(form);
      const updated: FinanceEntry = {
        id: item?.id ?? uuid(),
        tipo: formData.get('tipo') as 'receita' | 'despesa',
        categoria: String(formData.get('categoria') ?? ''),
        descricao: String(formData.get('descricao') ?? ''),
        valor: Number(formData.get('valor') ?? 0),
        data: new Date(String(formData.get('data') ?? new Date().toISOString())).toISOString(),
        status: formData.get('status') as ExpenseStatus,
        responsavel: String(formData.get('responsavel') ?? ''),
        processoId: (formData.get('processoId') as string) || null,
      };

      if (item) {
        this.state.financeiro = this.state.financeiro.map((entrada) => (entrada.id === item.id ? updated : entrada));
      } else {
        this.state.financeiro.push(updated);
      }

      this.persistState();
      closeModal();
      this.renderFinanceiro();
    });
  }
  private renderNotificacoes(): void {
    const container = document.getElementById('section-notificacoes');
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3>Notificações e alertas</h3>
          <p class="section-description">Avisos automáticos sobre prazos, agenda, honorários e tarefas conforme suas preferências.</p>
        </div>
        <button class="primary-button" id="limparNotificacoes">Limpar alertas automáticos</button>
      </div>
      <div class="list" id="notificacoesLista"></div>
    `;

    const lista = document.getElementById('notificacoesLista');
    if (!lista) {
      return;
    }

    const notificacoesOrdenadas = this.state.notificacoes
      .slice()
      .sort((a, b) => parseDate(b.data).getTime() - parseDate(a.data).getTime());

    lista.innerHTML =
      notificacoesOrdenadas
        .map((notificacao) => {
          const processo = notificacao.processoId
            ? this.state.processos.find((p) => p.id === notificacao.processoId)
            : undefined;
          return `
            <div class="notification-card">
              <strong>${notificacao.titulo}</strong>
              <small>${formatDate(notificacao.data)}${
            processo ? ` · Processo ${processo.numeroProcesso}` : ''
          }</small>
              <p>${notificacao.mensagem}</p>
            </div>
          `;
        })
        .join('') || '<p>Nenhum alerta disponível.</p>';

    document.getElementById('limparNotificacoes')?.addEventListener('click', () => {
      if (confirm('Remover todas as notificações automáticas geradas pelo sistema?')) {
        this.state.notificacoes = this.state.notificacoes.filter((n) => !n.auto);
        this.persistState();
        this.renderNotificacoes();
      }
    });
  }
  private renderConfiguracoes(): void {
    const container = document.getElementById('section-configuracoes');
    if (!container) {
      return;
    }

    const preferencias = this.currentUser?.preferencias ?? {
      prazos: true,
      agenda: true,
      honorarios: true,
      tarefas: true,
    };

    container.innerHTML = `
      <h3>Configurações e preferências</h3>
      <p class="section-description">Personalize categorias, tipos de perícia, status de processos e notificações por usuário.</p>
      <div class="settings-grid">
        <section class="section">
          <h3 style="margin-bottom:0.5rem">Preferências de notificações</h3>
          <form id="preferenciasForm" class="form-grid">
            <label><input type="checkbox" name="prazos" ${preferencias.prazos ? 'checked' : ''}/> Alertas de prazos</label>
            <label><input type="checkbox" name="agenda" ${preferencias.agenda ? 'checked' : ''}/> Agenda de perícias</label>
            <label><input type="checkbox" name="honorarios" ${preferencias.honorarios ? 'checked' : ''}/> Honorários</label>
            <label><input type="checkbox" name="tarefas" ${preferencias.tarefas ? 'checked' : ''}/> Tarefas</label>
            <button type="submit" class="primary-button">Salvar preferências</button>
          </form>
        </section>
        <section class="section">
          <h3 style="margin-bottom:0.5rem">Categorias de despesas</h3>
          <form id="categoriasForm" class="inline-form">
            <input type="text" name="categoria" placeholder="Adicionar categoria" required />
            <button type="submit" class="primary-button">Adicionar</button>
          </form>
          <div class="list" id="categoriasLista">
            ${this.state.configuracoes.categoriasDespesa
              .map(
                (categoria) =>
                  `<div class="notification-card">
                    <strong>${categoria}</strong>
                    <button data-remove-categoria="${categoria}">Remover</button>
                  </div>`,
              )
              .join('')}
          </div>
        </section>
        <section class="section">
          <h3 style="margin-bottom:0.5rem">Tipos de perícia</h3>
          <form id="tiposForm" class="inline-form">
            <input type="text" name="tipo" placeholder="Adicionar tipo" required />
            <button type="submit" class="primary-button">Adicionar</button>
          </form>
          <div class="list" id="tiposLista">
            ${this.state.configuracoes.tiposPericia
              .map(
                (tipo) =>
                  `<div class="notification-card">
                    <strong>${tipo}</strong>
                    <button data-remove-tipo="${tipo}">Remover</button>
                  </div>`,
              )
              .join('')}
          </div>
        </section>
        <section class="section">
          <h3 style="margin-bottom:0.5rem">Status de processo</h3>
          <form id="statusForm" class="inline-form">
            <input type="text" name="status" placeholder="Identificador interno" required />
            <input type="text" name="label" placeholder="Nome exibido" required />
            <button type="submit" class="primary-button">Adicionar</button>
          </form>
          <div class="list" id="statusLista">
            ${this.state.configuracoes.statusProcesso
              .map(
                (status) =>
                  `<div class="notification-card">
                    <strong>${status}</strong>
                    <span>${PROCESS_STATUS_LABEL[status] ?? status}</span>
                    <button data-remove-status="${status}">Remover</button>
                  </div>`,
              )
              .join('')}
          </div>
        </section>
        <section class="section">
          <h3 style="margin-bottom:0.5rem">Usuários cadastrados</h3>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Perfil</th>
                </tr>
              </thead>
              <tbody>
                ${this.state.usuarios
                  .map(
                    (user) => `
                      <tr>
                        <td>${user.nome}</td>
                        <td>${user.email}</td>
                        <td>${user.cpf}</td>
                        <td>${user.telefone}</td>
                        <td>${ROLE_LABEL[user.perfil]}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    document.getElementById('preferenciasForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.currentUser) {
        return;
      }
      const formData = new FormData(event.target as HTMLFormElement);
      this.currentUser.preferencias = {
        prazos: Boolean(formData.get('prazos')),
        agenda: Boolean(formData.get('agenda')),
        honorarios: Boolean(formData.get('honorarios')),
        tarefas: Boolean(formData.get('tarefas')),
      };
      this.state.usuarios = this.state.usuarios.map((user) =>
        user.id === this.currentUser?.id ? { ...user, preferencias: this.currentUser?.preferencias } : user,
      );
      this.persistState();
      alert('Preferências atualizadas com sucesso.');
    });

    document.getElementById('categoriasForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = (event.target as HTMLFormElement).querySelector('input[name="categoria"]') as HTMLInputElement;
      const value = input.value.trim();
      if (!value || this.state.configuracoes.categoriasDespesa.includes(value)) {
        return;
      }
      this.state.configuracoes.categoriasDespesa.push(value);
      this.persistState();
      this.renderConfiguracoes();
    });

    document.querySelectorAll('[data-remove-categoria]')?.forEach((button) => {
      button.addEventListener('click', () => {
        const value = (button as HTMLElement).getAttribute('data-remove-categoria');
        if (!value) {
          return;
        }
        this.state.configuracoes.categoriasDespesa = this.state.configuracoes.categoriasDespesa.filter(
          (categoria) => categoria !== value,
        );
        this.persistState();
        this.renderConfiguracoes();
      });
    });

    document.getElementById('tiposForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = (event.target as HTMLFormElement).querySelector('input[name="tipo"]') as HTMLInputElement;
      const value = input.value.trim();
      if (!value || this.state.configuracoes.tiposPericia.includes(value)) {
        return;
      }
      this.state.configuracoes.tiposPericia.push(value);
      this.persistState();
      this.renderConfiguracoes();
    });

    document.querySelectorAll('[data-remove-tipo]')?.forEach((button) => {
      button.addEventListener('click', () => {
        const value = (button as HTMLElement).getAttribute('data-remove-tipo');
        if (!value) {
          return;
        }
        this.state.configuracoes.tiposPericia = this.state.configuracoes.tiposPericia.filter((tipo) => tipo !== value);
        this.persistState();
        this.renderConfiguracoes();
      });
    });

    document.getElementById('statusForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const status = (form.querySelector('input[name="status"]') as HTMLInputElement).value.trim();
      const label = (form.querySelector('input[name="label"]') as HTMLInputElement).value.trim();
      if (!status || !label) {
        return;
      }
      if (!this.state.configuracoes.statusProcesso.includes(status as ProcessStatus)) {
        this.state.configuracoes.statusProcesso.push(status as ProcessStatus);
        PROCESS_STATUS_LABEL[status as ProcessStatus] = label;
        this.persistState();
        this.renderConfiguracoes();
      }
    });

    document.querySelectorAll('[data-remove-status]')?.forEach((button) => {
      button.addEventListener('click', () => {
        const value = (button as HTMLElement).getAttribute('data-remove-status') as ProcessStatus | null;
        if (!value) {
          return;
        }
        this.state.configuracoes.statusProcesso = this.state.configuracoes.statusProcesso.filter(
          (status) => status !== value,
        );
        delete PROCESS_STATUS_LABEL[value];
        this.persistState();
        this.renderConfiguracoes();
      });
    });
  }
  private generateNotifications(): void {
    const manual = this.state.notificacoes.filter((notificacao) => !notificacao.auto);
    const automaticas: NotificationItem[] = [];
    const now = new Date();

    const usuarios = this.state.usuarios.length ? this.state.usuarios : [
      {
        preferencias: { prazos: true, agenda: true, honorarios: true, tarefas: true },
      } as User,
    ];

    const shouldNotify = (tipo: NotificationType) =>
      usuarios.some((user) => {
        const prefKey = PREF_KEY[tipo];
        return user.preferencias?.[prefKey];
      });

    if (shouldNotify('agenda')) {
      this.state.eventos.forEach((evento) => {
        const diff = differenceInDays(evento.data, now);
        if (diff >= 0 && diff <= 7) {
          automaticas.push({
            id: uuid(),
            tipo: 'agenda',
            titulo: `Evento em ${formatDate(evento.data)}`,
            mensagem: `${evento.titulo} ocorrerá em ${diff} dia(s).`,
            data: new Date().toISOString(),
            processoId: evento.processoId,
            auto: true,
          });
        }
        if (evento.prazoEntrega && shouldNotify('prazo')) {
          const prazoDiff = differenceInDays(evento.prazoEntrega, now);
          if (prazoDiff >= 0 && prazoDiff <= 5) {
            automaticas.push({
              id: uuid(),
              tipo: 'prazo',
              titulo: 'Prazo de entrega próximo',
              mensagem: `O laudo referente a ${evento.titulo} vence em ${prazoDiff} dia(s).`,
              data: new Date().toISOString(),
              processoId: evento.processoId,
              auto: true,
            });
          }
        }
      });
    }

    if (shouldNotify('honorario')) {
      this.state.honorarios.forEach((honorario) => {
        if (honorario.status === 'recebido') {
          return;
        }
        const diff = differenceInDays(honorario.vencimento, now);
        if (diff <= 5) {
          automaticas.push({
            id: uuid(),
            tipo: 'honorario',
            titulo: diff < 0 ? 'Honorário em atraso' : 'Honorário próximo do vencimento',
            mensagem:
              diff < 0
                ? `Parcela "${honorario.descricao}" está ${Math.abs(diff)} dia(s) em atraso.`
                : `Parcela "${honorario.descricao}" vence em ${diff} dia(s).`,
            data: new Date().toISOString(),
            processoId: honorario.processoId,
            auto: true,
          });
        }
      });
    }

    if (shouldNotify('tarefa')) {
      this.state.tarefas.forEach((tarefa) => {
        if (tarefa.status === 'concluido') {
          return;
        }
        const diff = differenceInDays(tarefa.dataTermino, now);
        if (diff <= 3) {
          automaticas.push({
            id: uuid(),
            tipo: 'tarefa',
            titulo: 'Prazo de tarefa',
            mensagem:
              diff < 0
                ? `A tarefa "${tarefa.titulo}" está atrasada há ${Math.abs(diff)} dia(s).`
                : `A tarefa "${tarefa.titulo}" vence em ${diff} dia(s).`,
            data: new Date().toISOString(),
            processoId: tarefa.processoId,
            auto: true,
          });
        }
      });
    }

    this.state.notificacoes = [...manual, ...automaticas];

    if (this.activeSection === 'notificacoes') {
      this.renderNotificacoes();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicia a aplicação assim que o DOM estiver pronto.
  new CaseManagementApp();
});
