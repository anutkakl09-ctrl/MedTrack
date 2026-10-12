import { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Crosshair,
  Droplets,
  Ellipsis,
  Gauge,
  HeartPulse,
  Home,
  Menu,
  Moon,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Tablet,
  TimerReset,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { api } from './api';
import type {
  Activity,
  BootstrapData,
  Dose,
  Medication,
  Profile,
  SchedulePreview,
  Theme,
} from './types';

type View = 'overview' | 'medications' | 'calendar' | 'history' | 'profiles' | 'settings';

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Обзор', icon: Home },
  { id: 'medications', label: 'Лекарства', icon: Tablet },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'history', label: 'История', icon: ActivityIcon },
  { id: 'profiles', label: 'Профили', icon: Users },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(value?: string) {
  if (!value) return '—';
  return timeFormatter.format(new Date(value));
}

function formatDate(value?: string) {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

function formatDelay(minutes?: number) {
  if (!minutes) return 'вовремя';
  return '+' + minutes + ' мин';
}

function statusLabel(status: Dose['status']) {
  const labels: Record<Dose['status'], string> = {
    scheduled: 'Запланировано',
    reminder_sent: 'Напоминание отправлено',
    snoozed: 'Отложено',
    taken_on_time: 'Принято вовремя',
    taken_late: 'Принято с задержкой',
    skipped: 'Пропущено',
    missed: 'Пропущено',
    cancelled: 'Отменено',
    rescheduled: 'Время изменено',
  };
  return labels[status];
}

function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [view, setView] = useState<View>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const load = async (profileId?: string) => {
    setIsLoading(true);
    setError('');
    try {
      setData(await api.bootstrap(profileId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить приложение');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    const preferred = data.theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : data.theme === 'dark';
    root.dataset.theme = preferred ? 'dark' : 'light';
  }, [data?.theme]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return (
      <div className="error-screen">
        <div className="error-mark"><AlertTriangle size={28} /></div>
        <h1>Не удалось открыть MedTrack</h1>
        <p>{error || 'Попробуйте обновить приложение.'}</p>
        <button className="button button-primary" onClick={() => void load()}>
          Повторить
        </button>
      </div>
    );
  }

  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId) || data.profiles[0];

  if (!activeProfile) {
    return <OnboardingScreen userName={data.user.firstName} onCreated={async () => load()} />;
  }

  const navigate = (nextView: View) => {
    setView(nextView);
    setIsSidebarOpen(false);
  };

  const changeProfile = (profileId: string) => {
    void load(profileId);
  };

  const afterMutation = async () => {
    await load(data.activeProfileId);
  };

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (isSidebarOpen ? 'sidebar-open' : '')}>
        <div className="brand">
          <div className="brand-symbol"><Crosshair size={18} strokeWidth={2.4} /></div>
          <span>MEDTRACK</span>
        </div>

        <div className="sidebar-profile">
          <div className="avatar avatar-orange">{activeProfile?.displayName.slice(0, 1) || 'M'}</div>
          <div className="sidebar-profile-copy">
            <strong>{activeProfile?.displayName}</strong>
            <span>{activeProfile?.role === 'Owner' ? 'Владелец профиля' : activeProfile?.role}</span>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav className="sidebar-nav">
          <span className="nav-caption">РАБОЧАЯ ОБЛАСТЬ</span>
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={'nav-item ' + (view === item.id ? 'nav-item-active' : '')}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.id === 'overview' && <span className="nav-dot" />}
              </button>
            );
          })}
          <span className="nav-caption nav-caption-spaced">УПРАВЛЕНИЕ</span>
          {navItems.slice(4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={'nav-item ' + (view === item.id ? 'nav-item-active' : '')}
                onClick={() => navigate(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="telegram-status">
            <span className="status-pulse" />
            <span>TELEGRAM CONNECTED</span>
          </div>
          <div className="sidebar-version">
            <span>MEDTRACK OS</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </aside>

      {isSidebarOpen && <button className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setIsSidebarOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <button className="icon-button mobile-menu" aria-label="Открыть меню" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={19} />
            </button>
            <div className="brand-symbol"><Crosshair size={16} /></div>
            <span>MEDTRACK</span>
          </div>
          <div className="breadcrumb">
            <span>MedTrack</span>
            <ChevronRight size={13} />
            <strong>{navItems.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <div className="connection-chip"><span className="status-pulse" /> LIVE</div>
            <div className="topbar-divider" />
            <button
              className="icon-button notification-button"
              aria-label="Уведомления"
              onClick={() => setShowNotifications((current) => !current)}
            >
              <Bell size={17} />
              {notificationCount(data) > 0 && <span className="notification-badge">{notificationCount(data)}</span>}
            </button>
            <button className="user-chip" onClick={() => navigate('profiles')}>
              <span className="avatar avatar-small avatar-orange">{activeProfile?.displayName.slice(0, 1) || 'M'}</span>
              <span className="user-chip-name">{data.user.firstName}</span>
              <ChevronDown size={14} />
            </button>
          </div>
          {showNotifications && <NotificationPopover data={data} onClose={() => setShowNotifications(false)} />}
        </header>

        <div className="content-wrap">
          {view === 'overview' && (
            <OverviewView
              data={data}
              activeProfile={activeProfile}
              onNavigate={navigate}
              onAddMedication={() => setShowMedicationModal(true)}
              onAction={afterMutation}
            />
          )}
          {view === 'medications' && (
            <MedicationsView
              data={data}
              activeProfile={activeProfile}
              onAddMedication={() => setShowMedicationModal(true)}
              onAction={afterMutation}
            />
          )}
          {view === 'calendar' && <CalendarView data={data} />}
          {view === 'history' && <HistoryView data={data} />}
          {view === 'profiles' && (
            <ProfilesView
              data={data}
              onAdd={() => setShowProfileModal(true)}
              onSelect={changeProfile}
            />
          )}
          {view === 'settings' && <SettingsView data={data} onAction={afterMutation} />}
        </div>

        <footer className="main-footer">
          <span><ShieldCheck size={13} /> Данные защищены Telegram-сессией</span>
          <span>Не заменяет назначение врача</span>
        </footer>
      </main>

      {showMedicationModal && (
        <MedicationModal
          profileId={data.activeProfileId}
          profile={activeProfile}
          onClose={() => setShowMedicationModal(false)}
          onSaved={async () => {
            setShowMedicationModal(false);
            await afterMutation();
          }}
        />
      )}
      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          onSaved={async () => {
            setShowProfileModal(false);
            await afterMutation();
          }}
        />
      )}
    </div>
  );
}

function OnboardingScreen({ userName, onCreated }: { userName: string; onCreated: () => Promise<void> }) {
  const [name, setName] = useState(userName);
  const [isSaving, setIsSaving] = useState(false);
  const create = async () => {
    setIsSaving(true);
    try {
      await api.createProfile({ displayName: name.trim() || userName, type: 'self' });
      await onCreated();
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="onboarding-screen">
      <div className="onboarding-orbit"><Crosshair size={28} /></div>
      <span className="eyebrow">MEDTRACK / ПЕРВЫЙ ЗАПУСК</span>
      <h1>Настроим ваш первый профиль</h1>
      <p>Telegram уже определил вас. Осталось указать имя профиля — без отдельной регистрации и PIN-кода.</p>
      <div className="onboarding-form">
        <label className="field"><span>Имя профиля</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Алексей" /></label>
        <button className="button button-primary" disabled={isSaving} onClick={() => void create()}>{isSaving ? 'Создание…' : 'Создать профиль'} <ChevronRight size={15} /></button>
      </div>
      <small>Приложение помогает организовать расписание и не заменяет назначение врача.</small>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-orbit"><Crosshair size={28} /></div>
      <span>ИНИЦИАЛИЗАЦИЯ MEDTRACK</span>
      <div className="loading-line"><span /></div>
    </div>
  );
}

function NotificationPopover({ data, onClose }: { data: BootstrapData; onClose: () => void }) {
  const lowStock = data.medications.filter((med) => med.stockAmount <= med.lowStockThreshold);
  const nextDose = getNextActionableDose(data.doses);
  const totalNotifications = lowStock.length + (nextDose ? 1 : 0);
  return (
    <div className="notification-popover">
      <div className="popover-head">
        <div>
          <span className="eyebrow">ЦЕНТР УВЕДОМЛЕНИЙ</span>
          <strong>{totalNotifications ? totalNotifications + ' события требуют внимания' : 'Нет новых событий'}</strong>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={15} /></button>
      </div>
      {nextDose && (
        <div className="popover-item popover-item-accent">
          <BellRing size={16} />
          <div><strong>{doseNotificationTitle(nextDose.scheduledAt)}</strong><span>{nextDose.medicationName} • {formatTime(nextDose.scheduledAt)}</span></div>
        </div>
      )}
      {lowStock.map((med) => (
        <div className="popover-item" key={med.id}>
          <AlertTriangle size={16} />
          <div><strong>Заканчивается {med.name}</strong><span>Осталось {med.stockAmount} {med.stockUnit}</span></div>
        </div>
      ))}
      {!totalNotifications && <div className="popover-empty">Новых событий нет</div>}
    </div>
  );
}

function getNextActionableDose(doses: Dose[]) {
  return [...doses]
    .filter((dose) => dose.status === 'scheduled' || dose.status === 'reminder_sent' || dose.status === 'snoozed' || dose.status === 'rescheduled')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
}

function notificationCount(data: BootstrapData) {
  const lowStockCount = data.medications.filter((med) => med.stockAmount <= med.lowStockThreshold).length;
  return lowStockCount + (getNextActionableDose(data.doses) ? 1 : 0);
}

function doseNotificationTitle(scheduledAt: string) {
  const minutes = Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'Прием уже ожидает подтверждения';
  if (minutes < 60) return 'Следующий прием через ' + minutes + ' мин';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return 'Следующий прием через ' + hours + ' ч' + (remainingMinutes ? ' ' + remainingMinutes + ' мин' : '');
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function OverviewView({
  data,
  activeProfile,
  onNavigate,
  onAddMedication,
  onAction,
}: {
  data: BootstrapData;
  activeProfile: Profile;
  onNavigate: (view: View) => void;
  onAddMedication: () => void;
  onAction: () => Promise<void>;
}) {
  const today = new Date();
  const upcoming = [...data.doses]
    .filter((dose) => dose.status === 'scheduled' || dose.status === 'snoozed' || dose.status === 'rescheduled')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const nextDose = upcoming[0];
  const completion = data.stats.todayTotal ? Math.round((data.stats.todayTaken / data.stats.todayTotal) * 100) : 0;
  return (
    <>
      <PageHeading
        eyebrow="ПАНЕЛЬ КОНТРОЛЯ / СЕГОДНЯ"
        title={'Добрый день, ' + data.user.firstName}
        description={formatDate(today.toISOString()) + ' • ' + activeProfile.displayName + ' • ' + activeProfile.timezone}
        action={
          <div className="heading-actions">
            <button className="button button-secondary" onClick={() => onNavigate('calendar')}><CalendarDays size={16} /> Открыть календарь</button>
            <button className="button button-primary" onClick={onAddMedication}><Plus size={17} /> Добавить лекарство</button>
          </div>
        }
      />

      <div className="system-strip">
        <div className="system-strip-left"><span className="status-pulse status-pulse-bright" /><strong>СИСТЕМА АКТИВНА</strong><span>Последняя синхронизация только что</span></div>
        <div className="system-strip-right"><span>Часовой пояс</span><strong>{activeProfile.timezone}</strong><span className="strip-separator" /><span>Серия</span><strong>{data.stats.streak} дней</strong></div>
      </div>

      <section className="hero-grid">
        <div className="card next-dose-card">
          <CardTop label="01 / БЛИЖАЙШИЙ ПРИЕМ" icon={<BellRing size={14} />} />
          <div className="next-dose-content">
            <div className="next-dose-time">{nextDose ? formatTime(nextDose.scheduledAt) : '—'}</div>
            <div className="next-dose-meta">
              <span className="live-tag"><span className="status-pulse" /> СЛЕДУЮЩИЙ</span>
              <span>{nextDose ? nextDose.medicationName : 'Все приемы завершены'}</span>
            </div>
            {nextDose && <p>{data.medications.find((med) => med.id === nextDose.medicationId)?.customInstruction || 'Согласно расписанию'}</p>}
          </div>
          <div className="card-footer-row">
            <span>До приема</span>
            <strong>{nextDose ? countdownLabel(nextDose.scheduledAt) : '—'}</strong>
            <button className="text-button" onClick={() => onNavigate('calendar')}>Подробнее <ChevronRight size={14} /></button>
          </div>
        </div>

        <div className="card day-progress-card">
          <CardTop label="02 / ПРОГРЕСС ДНЯ" icon={<Gauge size={14} />} />
          <div className="progress-stat-row">
            <div><strong className="large-number">{data.stats.todayTaken}</strong><span>из {data.stats.todayTotal || 0} приемов</span></div>
            <div className="progress-percent">{completion}%</div>
          </div>
          <div className="segmented-progress">
            {Array.from({ length: Math.max(6, data.stats.todayTotal) }).map((_, index) => (
              <span key={index} className={index < data.stats.todayTaken ? 'segment-filled' : index === data.stats.todayTaken ? 'segment-current' : ''} />
            ))}
          </div>
          <div className="mini-stats">
            <span><i className="dot dot-green" /> Вовремя <strong>{Math.max(0, data.stats.todayTaken - data.stats.todayLate)}</strong></span>
            <span><i className="dot dot-orange" /> С задержкой <strong>{data.stats.todayLate}</strong></span>
            <span><i className="dot dot-muted" /> Пропущено <strong>{data.stats.todayMissed}</strong></span>
          </div>
        </div>

        <div className="card adherence-card">
          <CardTop label="03 / СОБЛЮДЕНИЕ" icon={<HeartPulse size={14} />} />
          <div className="ring-wrap">
            <div className="adherence-ring" style={{ '--ring-progress': data.stats.adherence * 3.6 + 'deg' } as React.CSSProperties}>
              <div><strong>{data.stats.adherence}%</strong><span>за 30 дней</span></div>
            </div>
            <div className="ring-legend"><span><i className="dot dot-orange" /> Текущий месяц</span><span><i className="dot dot-muted" /> Цель: 95%</span></div>
          </div>
          <div className="card-footer-row"><span>Динамика</span><strong className="positive">+4,2%</strong><TrendSpark /></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card schedule-card">
          <CardTop label="04 / СЕГОДНЯ" icon={<Clock3 size={14} />} action={<button className="card-action" onClick={() => onNavigate('calendar')}>Весь день <ChevronRight size={14} /></button>} />
          <div className="timeline">
            {data.doses.slice(0, 5).map((dose, index) => <DoseTimelineItem key={dose.id} dose={dose} index={index} onAction={onAction} />)}
            {data.doses.length === 0 && <EmptyState icon={<Clock3 size={22} />} title="Приемов пока нет" text="Добавьте лекарство, чтобы увидеть расписание." />}
          </div>
        </div>

        <div className="card stock-card">
          <CardTop label="05 / ЗАПАС ЛЕКАРСТВ" icon={<Package size={14} />} action={<button className="card-action" onClick={() => onNavigate('medications')}>Управление <ChevronRight size={14} /></button>} />
          <div className="stock-list">
            {data.medications.map((med) => <StockRow key={med.id} medication={med} />)}
            {data.medications.length === 0 && <EmptyState icon={<Package size={22} />} title="Нет лекарств" text="Добавьте первое лекарство." />}
          </div>
          <div className="stock-summary"><span><i className="dot dot-orange" /> Низкий запас <strong>{data.stats.lowStockCount}</strong></span><span>Всего позиций <strong>{data.medications.length}</strong></span></div>
        </div>

        <div className="card activity-card">
          <CardTop label="06 / ПОСЛЕДНИЕ СОБЫТИЯ" icon={<ActivityIcon size={14} />} action={<button className="card-action" onClick={() => onNavigate('history')}>История <ChevronRight size={14} /></button>} />
          <div className="activity-list">
            {data.activities.slice(0, 4).map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
          </div>
        </div>

        <div className="card weekly-card">
          <CardTop label="07 / НЕДЕЛЬНАЯ ДИНАМИКА" icon={<Zap size={14} />} action={<span className="chart-period">ПОСЛЕДНИЕ 7 ДНЕЙ</span>} />
          <WeeklyChart />
          <div className="chart-footer"><span><i className="dot dot-orange" /> Соблюдение</span><strong>{data.stats.adherence}% <span className="positive">+4,2%</span></strong></div>
        </div>
      </section>
    </>
  );
}

function CardTop({ label, icon, action }: { label: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="card-top"><span className="card-label">{icon}{label}</span>{action}</div>;
}

function DoseTimelineItem({ dose, index, onAction }: { dose: Dose; index: number; onAction: () => Promise<void> }) {
  const done = dose.status === 'taken_on_time' || dose.status === 'taken_late';
  const missed = dose.status === 'missed' || dose.status === 'skipped';
  const take = async () => {
    await api.doseAction(dose.id, 'take');
    await onAction();
  };
  return (
    <div className={'timeline-item ' + (done ? 'timeline-done' : missed ? 'timeline-missed' : index === 1 ? 'timeline-current' : '')}>
      <div className="timeline-time">{formatTime(dose.scheduledAt)}</div>
      <div className="timeline-line"><span className="timeline-node" /></div>
      <div className="timeline-main">
        <div className="dose-name"><span className="med-color" style={{ background: dose.medicationColor }} /> <strong>{dose.medicationName}</strong><span className="dose-amount">× {dose.doseAmount}</span></div>
        <span className="dose-status">{done ? statusLabel(dose.status) + ' • ' + formatDelay(dose.delayMinutes) : missed ? statusLabel(dose.status) : 'Ожидает подтверждения'}</span>
      </div>
      {!done && !missed && <button className="small-check" aria-label="Отметить прием" onClick={() => void take()}><Check size={14} /></button>}
      {done && <span className="done-check"><Check size={13} /></span>}
    </div>
  );
}

function StockRow({ medication }: { medication: Medication }) {
  const low = medication.stockAmount <= medication.lowStockThreshold;
  const percentage = Math.min(100, Math.round((medication.stockAmount / Math.max(1, medication.packageSize)) * 100));
  return (
    <div className="stock-row">
      <div className="stock-icon" style={{ color: medication.color }}><Tablet size={17} /></div>
      <div className="stock-info"><strong>{medication.name}</strong><span>{medication.dosage || medication.form}</span></div>
      <div className="stock-meter-wrap"><div className="stock-meter"><span style={{ width: percentage + '%', background: medication.color }} /></div><span>{medication.stockAmount} {medication.stockUnit}</span></div>
      <span className={'stock-state ' + (low ? 'stock-state-low' : '')}>{low ? 'МАЛО' : 'OK'}</span>
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const icon = activity.tone === 'success' ? <Check size={13} /> : activity.tone === 'warning' ? <AlertTriangle size={13} /> : activity.tone === 'accent' ? <Bell size={13} /> : <ActivityIcon size={13} />;
  return <div className="activity-row"><span className={'activity-icon activity-' + activity.tone}>{icon}</span><div><strong>{activity.title}</strong><span>{activity.detail}</span></div><time>{activity.time}</time></div>;
}

function WeeklyChart() {
  return (
    <div className="weekly-chart">
      <div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
      <div className="chart-plot">
        <div className="chart-grid-lines"><span /><span /><span /><span /><span /></div>
        <svg viewBox="0 0 520 150" preserveAspectRatio="none" aria-label="График соблюдения">
          <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff5a1f" stopOpacity=".28" /><stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" /></linearGradient></defs>
          <path d="M0 116 C35 105 38 94 75 99 S115 82 150 88 S190 54 225 71 S270 70 300 54 S345 65 370 42 S420 52 445 31 S485 40 520 18 L520 150 L0 150 Z" fill="url(#chartFill)" />
          <path d="M0 116 C35 105 38 94 75 99 S115 82 150 88 S190 54 225 71 S270 70 300 54 S345 65 370 42 S420 52 445 31 S485 40 520 18" fill="none" stroke="#ff5a1f" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
          <circle cx="370" cy="42" r="4" fill="#161616" stroke="#ff5a1f" strokeWidth="2" />
        </svg>
        <div className="chart-x"><span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span></div>
      </div>
    </div>
  );
}

function TrendSpark() {
  return <svg className="trend-spark" viewBox="0 0 78 24" preserveAspectRatio="none"><path d="M0 19 C10 19 10 13 20 15 S30 8 39 12 S48 7 58 8 S67 3 78 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

function MedicationsView({
  data,
  activeProfile,
  onAddMedication,
  onAction,
}: {
  data: BootstrapData;
  activeProfile: Profile;
  onAddMedication: () => void;
  onAction: () => Promise<void>;
}) {
  return (
    <>
      <PageHeading
        eyebrow="УПРАВЛЕНИЕ / ЛЕКАРСТВА"
        title="Лекарства"
        description={'Активные назначения профиля ' + activeProfile.displayName}
        action={<button className="button button-primary" onClick={onAddMedication}><Plus size={17} /> Добавить лекарство</button>}
      />
      <div className="list-toolbar">
        <div className="search-field"><Search size={16} /><input placeholder="Поиск по лекарствам" /></div>
        <div className="toolbar-meta"><span><i className="dot dot-green" /> {data.medications.length} активных</span><button className="button button-secondary button-compact"><MoreHorizontal size={16} /> Фильтры</button></div>
      </div>
      <div className="medication-grid">
        {data.medications.map((med) => <MedicationCard key={med.id} medication={med} onAction={onAction} />)}
        <button className="add-medication-card" onClick={onAddMedication}><span><Plus size={21} /></span><strong>Добавить лекарство</strong><small>Настроить расписание и запас</small></button>
      </div>
      <div className="info-banner"><CircleHelp size={17} /><span>Настройки расписания можно изменить в любой момент. История уже подтвержденных приемов сохраняется.</span></div>
    </>
  );
}

function MedicationCard({ medication, onAction }: { medication: Medication; onAction: () => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [restockAmount, setRestockAmount] = useState(medication.packageSize || 30);
  const low = medication.stockAmount <= medication.lowStockThreshold;
  const restock = async () => {
    await api.restock(medication.id, restockAmount);
    await onAction();
  };
  const archive = async () => {
    if (!window.confirm('Архивировать ' + medication.name + '?')) return;
    await api.deleteMedication(medication.id);
    await onAction();
  };
  const takeNow = async () => {
    await api.takeNow(medication.id);
    await onAction();
  };
  return (
    <div className="card medication-card">
      <div className="med-card-head">
        <div className="med-title-wrap"><div className="med-large-icon" style={{ color: medication.color, background: medication.color + '18' }}><Tablet size={21} /></div><div><span className="eyebrow">ЛЕКАРСТВО</span><h3>{medication.name}</h3><p>{medication.form} • {medication.dosage || 'дозировка не указана'}</p></div></div>
        <button className="icon-button" onClick={() => setExpanded((value) => !value)} aria-label="Дополнительные действия"><Ellipsis size={18} /></button>
      </div>
      <div className="med-card-divider" />
      <div className="med-card-stats"><div><span>РАСПИСАНИЕ</span><strong>{medication.scheduleLabel}</strong></div><div><span>ДОЗА</span><strong>{medication.doseAmount} {medication.form.toLowerCase()}</strong></div><div><span>СЛЕДУЮЩИЙ</span><strong>{formatTime(medication.nextDoseAt)}</strong></div></div>
      <div className="med-stock-line"><div className="stock-info-inline"><Package size={14} /><span>Осталось</span><strong className={low ? 'text-warning' : ''}>{medication.stockAmount} {medication.stockUnit}</strong></div><div className="stock-meter"><span style={{ width: Math.min(100, (medication.stockAmount / Math.max(1, medication.packageSize)) * 100) + '%', background: medication.color }} /></div><span className={low ? 'text-warning' : 'muted'}>{low ? 'нужно пополнить' : Math.round((medication.stockAmount / Math.max(1, medication.packageSize)) * 100) + '%'}</span></div>
      <div className="med-card-foot"><span className={'med-status ' + (low ? 'med-status-warning' : '')}><span className="status-pulse" /> {low ? 'Низкий запас' : 'Прием активен'}</span><div className="med-card-actions"><button className="text-button" onClick={() => void takeNow()}><Check size={13} /> Принять сейчас</button><button className="text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Скрыть' : 'Управление'} <ChevronRight size={14} /></button></div></div>
      {expanded && <div className="med-expanded"><div className="expanded-row"><label>Добавить упаковку</label><div className="inline-input"><input type="number" min="1" value={restockAmount} onChange={(event) => setRestockAmount(Number(event.target.value))} /><span>{medication.stockUnit}</span><button className="button button-primary button-compact" onClick={() => void restock()}><Plus size={14} /> Добавить</button></div></div><div className="expanded-row"><span className="muted">Правило задержки</span><strong>{rescheduleLabel(medication.reschedulePolicy)}</strong></div><button className="danger-button" onClick={() => void archive()}>Архивировать лекарство</button></div>}
    </div>
  );
}

function rescheduleLabel(policy: Medication['reschedulePolicy']) {
  const labels: Record<Medication['reschedulePolicy'], string> = { none: 'Не пересчитывать', shift_all: 'Сдвигать последующие', minimum_interval: 'Сохранять интервал', waking_hours: 'В пределах бодрствования', ask: 'Спрашивать каждый раз' };
  return labels[policy];
}

function CalendarView({ data }: { data: BootstrapData }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 4 + index);
    return date;
  });
  const selectedKey = selectedDate.toISOString().slice(0, 10);
  const selectedDoses = data.doses.filter((dose) => dose.scheduledAt.slice(0, 10) === selectedKey);
  return (
    <>
      <PageHeading eyebrow="ПЛАНИРОВАНИЕ / КАЛЕНДАРЬ" title="Календарь приемов" description="Следите за расписанием и отмечайте изменения по дням." action={<div className="segmented-control"><button className="active">День</button><button>Неделя</button><button>Месяц</button></div>} />
      <div className="calendar-layout">
        <div className="card calendar-main">
          <div className="calendar-head"><button className="icon-button"><ChevronRight size={16} className="rotate-180" /></button><div><span className="eyebrow">ТЕКУЩИЙ ПЕРИОД</span><strong>{formatDate(selectedDate.toISOString())}</strong></div><button className="icon-button"><ChevronRight size={16} /></button></div>
          <div className="calendar-strip">{days.map((day) => { const key = day.toISOString().slice(0, 10); const isSelected = key === selectedKey; const dayDoses = data.doses.filter((dose) => dose.scheduledAt.slice(0, 10) === key); return <button key={key} className={'calendar-day ' + (isSelected ? 'calendar-day-selected' : '')} onClick={() => setSelectedDate(day)}><span>{day.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2)}</span><strong>{day.getDate()}</strong><i className={dayDoses.length ? 'has-doses' : ''} /></button>; })}</div>
          <div className="calendar-day-heading"><div><span className="eyebrow">РАСПИСАНИЕ</span><h3>{selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div><span className="calendar-count">{selectedDoses.length} приема</span></div>
          <div className="calendar-dose-list">{selectedDoses.length ? selectedDoses.map((dose) => <DoseDetailRow key={dose.id} dose={dose} />) : <EmptyState icon={<CalendarDays size={22} />} title="Нет приемов" text="На выбранную дату приемы не запланированы." />}</div>
        </div>
        <div className="calendar-side"><div className="card legend-card"><CardTop label="СТАТУСЫ" icon={<Palette size={14} />} /><div className="legend-list"><span><i className="legend-dot legend-green" /> Принято вовремя</span><span><i className="legend-dot legend-orange" /> Принято с задержкой</span><span><i className="legend-dot legend-red" /> Пропущено</span><span><i className="legend-dot legend-blue" /> Изменено вручную</span></div></div><div className="card calendar-summary"><CardTop label="СВОДКА НЕДЕЛИ" icon={<Gauge size={14} />} /><strong className="summary-number">{data.stats.adherence}%</strong><span className="muted">соблюдение расписания</span><div className="summary-bars"><i style={{ height: '54%' }} /><i style={{ height: '72%' }} /><i style={{ height: '66%' }} /><i style={{ height: '91%' }} /><i style={{ height: '78%' }} /><i style={{ height: '88%' }} /><i style={{ height: '94%' }} /></div></div></div>
      </div>
    </>
  );
}

function DoseDetailRow({ dose }: { dose: Dose }) {
  const complete = dose.status === 'taken_on_time' || dose.status === 'taken_late';
  return <div className="dose-detail-row"><div className="dose-detail-time">{formatTime(dose.scheduledAt)}</div><span className="med-color" style={{ background: dose.medicationColor }} /><div className="dose-detail-main"><strong>{dose.medicationName}</strong><span>{dose.doseAmount} доза • {statusLabel(dose.status)}</span></div><div className={'dose-detail-status ' + (complete ? 'detail-complete' : dose.status === 'skipped' ? 'detail-missed' : '')}>{complete ? <><Check size={14} /> {formatTime(dose.actualTakenAt)}</> : dose.status === 'skipped' ? 'Пропущено' : 'Ожидает'}</div></div>;
}

function HistoryView({ data }: { data: BootstrapData }) {
  const history = data.doses.filter((dose) => dose.status !== 'scheduled').sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  return (
    <>
      <PageHeading eyebrow="АНАЛИТИКА / ИСТОРИЯ" title="История приемов" description="Подробный журнал действий по выбранному профилю." action={<button className="button button-secondary"><RefreshCw size={16} /> Обновить данные</button>} />
      <div className="history-stats"><StatCard label="СОБЛЮДЕНИЕ" value={data.stats.adherence + '%'} detail="+4,2% к прошлому периоду" icon={<HeartPulse size={18} />} tone="orange" /><StatCard label="ПРИНЯТО ВОВРЕМЯ" value={String(Math.max(0, data.stats.todayTaken - data.stats.todayLate))} detail="за текущий период" icon={<Check size={18} />} tone="green" /><StatCard label="С ЗАДЕРЖКОЙ" value={String(data.stats.todayLate)} detail="требует внимания" icon={<Clock3 size={18} />} tone="purple" /><StatCard label="ПРОПУЩЕНО" value={String(data.stats.todayMissed)} detail="за текущий период" icon={<AlertTriangle size={18} />} tone="red" /></div>
      <div className="card history-table-card"><div className="table-toolbar"><div className="search-field"><Search size={16} /><input placeholder="Поиск в истории" /></div><div className="filter-pills"><button className="filter-pill active">Все</button><button className="filter-pill">Принято</button><button className="filter-pill">Пропущено</button><button className="filter-pill">Изменено</button></div></div>{history.length ? <div className="history-table"><div className="table-head"><span>ЛЕКАРСТВО</span><span>ПЛАНОВОЕ ВРЕМЯ</span><span>ФАКТИЧЕСКОЕ</span><span>СТАТУС</span><span>ЗАДЕРЖКА</span></div>{history.map((dose) => <div className="table-row" key={dose.id}><div className="table-med"><span className="med-color" style={{ background: dose.medicationColor }} /><strong>{dose.medicationName}</strong></div><span>{formatDate(dose.scheduledAt)}<small>{formatTime(dose.scheduledAt)}</small></span><span>{dose.actualTakenAt ? formatTime(dose.actualTakenAt) : '—'}</span><span><span className={'table-status table-status-' + dose.status}>{statusLabel(dose.status)}</span></span><span className={dose.delayMinutes ? 'text-warning' : 'text-success'}>{formatDelay(dose.delayMinutes)}</span></div>)}</div> : <EmptyState icon={<ActivityIcon size={22} />} title="История пока пуста" text="Подтвержденные приемы появятся здесь." />}</div>
    </>
  );
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className="card stat-card"><div className={'stat-icon stat-icon-' + tone}>{icon}</div><span className="card-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function ProfilesView({ data, onAdd, onSelect }: { data: BootstrapData; onAdd: () => void; onSelect: (id: string) => void }) {
  return (
    <>
      <PageHeading eyebrow="УПРАВЛЕНИЕ / ПРОФИЛИ" title="Профили" description="Управляйте расписаниями нескольких людей в одном рабочем пространстве." action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Добавить профиль</button>} />
      <div className="profiles-grid">{data.profiles.map((profile) => <button className={'card profile-card ' + (profile.id === data.activeProfileId ? 'profile-card-active' : '')} key={profile.id} onClick={() => onSelect(profile.id)}><div className="profile-card-top"><div className="avatar avatar-large" style={{ background: profile.avatarColor }}>{profile.displayName.slice(0, 1)}</div>{profile.id === data.activeProfileId && <span className="active-badge"><Check size={12} /> Активный</span>}</div><h3>{profile.displayName}</h3><span className="muted">{profile.type === 'self' ? 'Мой профиль' : 'Семейный профиль'}</span><div className="profile-card-foot"><span><Users size={14} /> {profile.memberCount} участник</span><span>{profile.role}</span></div></button>)}<button className="add-profile-card" onClick={onAdd}><Plus size={22} /><strong>Новый профиль</strong><span>Для себя или близкого</span></button></div>
      <div className="info-banner"><Users size={17} /><span>Пригласите родственника или помощника в профиль через Telegram. Права доступа можно будет ограничить.</span></div>
    </>
  );
}

function SettingsView({ data, onAction }: { data: BootstrapData; onAction: () => Promise<void> }) {
  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId)!;
  const [notificationSettings, setNotificationSettings] = useState(activeProfile.notificationSettings);

  useEffect(() => {
    setNotificationSettings(activeProfile.notificationSettings);
  }, [activeProfile.id, activeProfile.notificationSettings]);

  const setTheme = async (theme: Theme) => {
    await api.updateProfile(activeProfile.id, { theme });
    await onAction();
  };

  const saveNotificationSettings = async (next: typeof notificationSettings) => {
    setNotificationSettings(next);
    await api.updateProfile(activeProfile.id, { notificationSettings: next });
    await onAction();
  };

  const toggleOffset = (offset: number) => {
    const offsets = notificationSettings.reminderOffsets.includes(offset)
      ? notificationSettings.reminderOffsets.filter((item) => item !== offset)
      : [...notificationSettings.reminderOffsets, offset].sort((a, b) => b - a);
    void saveNotificationSettings({ ...notificationSettings, reminderOffsets: offsets });
  };

  return (
    <>
      <PageHeading eyebrow="СИСТЕМА / НАСТРОЙКИ" title="Настройки" description="Персонализируйте MedTrack под свой ритм и способ приема." />
      <div className="settings-layout"><div className="settings-nav card"><span className="settings-nav-title">РАЗДЕЛЫ</span><button className="settings-nav-item active"><Palette size={16} /> Внешний вид</button><button className="settings-nav-item"><Bell size={16} /> Уведомления</button><button className="settings-nav-item"><Clock3 size={16} /> Расписание</button><button className="settings-nav-item"><ShieldCheck size={16} /> Данные и доступ</button></div><div className="settings-content"><div className="card settings-section"><CardTop label="ВНЕШНИЙ ВИД" icon={<Palette size={14} />} /><div className="setting-row"><div><strong>Тема интерфейса</strong><span>Выберите оформление Mini App</span></div><div className="theme-options">{(['dark', 'light', 'system'] as Theme[]).map((theme) => <button key={theme} className={'theme-option ' + (activeProfile.theme === theme ? 'theme-option-active' : '')} onClick={() => void setTheme(theme)}>{theme === 'dark' ? <Moon size={15} /> : theme === 'light' ? <Sun size={15} /> : <Settings size={15} />}<span>{theme === 'dark' ? 'Темная' : theme === 'light' ? 'Светлая' : 'Системная'}</span></button>)}</div></div></div><div className="card settings-section"><CardTop label="ПРОФИЛЬ И ВРЕМЯ" icon={<UserRound size={14} />} /><SettingValue label="Профиль" value={activeProfile.displayName} /><SettingValue label="Часовой пояс" value={activeProfile.timezone} /><SettingValue label="Время бодрствования" value={activeProfile.wakeTime + ' — ' + activeProfile.sleepTime} /><SettingValue label="Приемы пищи" value={activeProfile.breakfastTime + ' / ' + activeProfile.lunchTime + ' / ' + activeProfile.dinnerTime} /></div><div className="card settings-section"><CardTop label="УВЕДОМЛЕНИЯ" icon={<Bell size={14} />} /><SettingToggle label="Напоминания о приеме" detail="Получать уведомления в чате Telegram" checked={notificationSettings.enabled} onClick={() => void saveNotificationSettings({ ...notificationSettings, enabled: !notificationSettings.enabled })} /><div className="notification-offsets"><strong>Напоминать заранее</strong><span>Можно оставить несколько вариантов или полностью отключить уведомления.</span><div className="notification-offset-grid">{[60, 30, 5].map((offset) => <button key={offset} className={'offset-option ' + (notificationSettings.reminderOffsets.includes(offset) ? 'offset-option-active' : '')} disabled={!notificationSettings.enabled} onClick={() => toggleOffset(offset)}>{offset === 60 ? 'За 1 час' : 'За ' + offset + ' минут'}</button>)}</div><label className="custom-offset"><span>Свое время, минут</span><input type="number" min="1" max="10080" placeholder="Например, 15" disabled={!notificationSettings.enabled} onKeyDown={(event) => { if (event.key !== 'Enter') return; const offset = Number(event.currentTarget.value); if (Number.isInteger(offset) && offset > 0 && offset <= 10080) { toggleOffset(offset); event.currentTarget.value = ''; } }} /></label><div className="selected-offsets">{notificationSettings.reminderOffsets.length ? notificationSettings.reminderOffsets.map((offset) => <button type="button" className="selected-offset" key={offset} disabled={!notificationSettings.enabled} onClick={() => toggleOffset(offset)}>{offset >= 60 ? 'За ' + Math.floor(offset / 60) + ' ч' : 'За ' + offset + ' мин'} <X size={10} /></button>) : <span>Предварительных уведомлений нет</span>}</div></div><SettingToggle label="Уведомление в момент приема" detail="Показать кнопки «Принял/а» и «Нет»" checked={notificationSettings.atDoseEnabled} onClick={() => void saveNotificationSettings({ ...notificationSettings, atDoseEnabled: !notificationSettings.atDoseEnabled })} /><SettingToggle label="Низкий остаток" detail="Предупреждать, когда лекарство заканчивается" checked /><SettingToggle label="Ежедневная сводка" detail="Короткая сводка вечером" checked /></div></div></div>
    </>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return <div className="setting-row setting-value-row"><div><strong>{label}</strong></div><span>{value}<ChevronRight size={14} /></span></div>;
}

function SettingToggle({ label, detail, checked, onClick }: { label: string; detail: string; checked: boolean; onClick?: () => void }) {
  return <button className="setting-row setting-toggle-button" onClick={onClick} disabled={!onClick}><div><strong>{label}</strong><span>{detail}</span></div><span className={'toggle ' + (checked ? 'toggle-on' : '')}><i /></span></button>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}

function MedicationModal({ profileId, profile, onClose, onSaved }: { profileId: string; profile: Profile; onClose: () => void; onSaved: () => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [form, setForm] = useState({
    name: '',
    form: 'Таблетка',
    dosage: '',
    doseAmount: 1,
    stockAmount: 30,
    stockUnit: 'таблетки',
    packageSize: 30,
    lowStockThreshold: 5,
    scheduleType: 'fixed',
    timesOfDay: ['09:00'],
    firstDoseTime: '09:00',
    intervalHours: 6,
    mealType: 'breakfast',
    mealOffsetMinutes: 0,
    intakeCondition: 'anytime',
    reschedulePolicy: 'ask',
    allowNightDoses: false,
  });

  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const calculate = async () => {
    const result = await api.previewSchedule({ ...form, ...profile });
    setPreview(result);
    setStep(5);
  };
  const save = async () => {
    setIsSaving(true);
    try {
      await api.createMedication({
        profileId,
        ...form,
        scheduleLabel:
          form.scheduleType === 'interval'
            ? 'Каждые ' + form.intervalHours + ' ч'
            : form.scheduleType === 'meal'
              ? 'После приема пищи'
              : form.scheduleType === 'as_needed'
                ? 'По необходимости'
                : 'Каждый день • ' + form.timesOfDay.join(', '),
      });
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal medication-modal">
        <div className="modal-head"><div><span className="eyebrow">НОВОЕ ЛЕКАРСТВО / ШАГ {step} ИЗ 5</span><h2>Добавить лекарство</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button></div>
        <div className="wizard-progress">{[1, 2, 3, 4, 5].map((item) => <span key={item} className={item <= step ? 'wizard-active' : ''} />)}</div>
        {step === 1 && <div className="modal-body"><div className="form-grid"><Field label="Название лекарства" required><input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Например, Витамин D3" /></Field><Field label="Форма"><select value={form.form} onChange={(event) => update('form', event.target.value)}><option>Таблетка</option><option>Капсула</option><option>Сироп</option><option>Капли</option><option>Порошок</option><option>Другое</option></select></Field><Field label="Дозировка"><input value={form.dosage} onChange={(event) => update('dosage', event.target.value)} placeholder="Например, 100 мг" /></Field><Field label="Количество на один прием"><input type="number" min="0.1" step="0.1" value={form.doseAmount} onChange={(event) => update('doseAmount', Number(event.target.value))} /></Field></div><FormHint text="Название и дозировка будут отображаться в уведомлениях Telegram." /></div>}
        {step === 2 && <div className="modal-body"><div className="form-grid"><Field label="Текущий остаток" required><input type="number" min="0" value={form.stockAmount} onChange={(event) => update('stockAmount', Number(event.target.value))} /></Field><Field label="Единица учета"><select value={form.stockUnit} onChange={(event) => update('stockUnit', event.target.value)}><option>таблетки</option><option>капсулы</option><option>мл</option><option>дозы</option><option>штуки</option></select></Field><Field label="Размер упаковки"><input type="number" min="0" value={form.packageSize} onChange={(event) => update('packageSize', Number(event.target.value))} /></Field><Field label="Предупредить при остатке"><input type="number" min="0" value={form.lowStockThreshold} onChange={(event) => update('lowStockThreshold', Number(event.target.value))} /></Field></div><div className="stock-preview"><Package size={18} /><div><strong>{form.stockAmount} {form.stockUnit}</strong><span>примерно {Math.floor(form.stockAmount / Math.max(1, form.doseAmount))} приемов</span></div></div></div>}
        {step === 3 && <div className="modal-body"><Field label="Тип расписания"><div className="schedule-types">{[['fixed', <Clock3 size={16} />, 'По времени'], ['interval', <TimerReset size={16} />, 'Через интервал'], ['meal', <Coffee size={16} />, 'Относительно еды'], ['as_needed', <Droplets size={16} />, 'По необходимости']].map(([value, icon, label]) => <button key={String(value)} className={'schedule-type ' + (form.scheduleType === value ? 'schedule-type-active' : '')} onClick={() => update('scheduleType', value)}>{icon}<span>{label}</span></button>)}</div></Field>{form.scheduleType === 'fixed' && <div className="form-grid"><Field label="Время приема"><input type="time" value={form.timesOfDay[0]} onChange={(event) => update('timesOfDay', [event.target.value])} /></Field><Field label="Дни"><select><option>Каждый день</option><option>По будням</option><option>По выбранным дням</option></select></Field></div>}{form.scheduleType === 'interval' && <div className="form-grid"><Field label="Интервал, часов"><input type="number" min="1" max="72" value={form.intervalHours} onChange={(event) => update('intervalHours', Number(event.target.value))} /></Field><Field label="Первый прием"><input type="time" value={form.firstDoseTime} onChange={(event) => update('firstDoseTime', event.target.value)} /></Field></div>}{form.scheduleType === 'meal' && <div className="form-grid"><Field label="Относительно"><select value={form.mealType} onChange={(event) => update('mealType', event.target.value)}><option value="breakfast">Завтрака</option><option value="lunch">Обеда</option><option value="dinner">Ужина</option></select></Field><Field label="Смещение, минут"><input type="number" value={form.mealOffsetMinutes} onChange={(event) => update('mealOffsetMinutes', Number(event.target.value))} /></Field></div>}{form.scheduleType !== 'as_needed' && <label className="check-field"><input type="checkbox" checked={form.allowNightDoses} onChange={(event) => update('allowNightDoses', event.target.checked)} /><span>Разрешить ночные уведомления</span></label>}</div>}
        {step === 4 && <div className="modal-body"><Field label="Что делать при задержке или пропуске"><div className="policy-list">{[['ask', 'Спрашивать каждый раз', 'Я выберу, что делать с дальнейшим расписанием'], ['none', 'Не пересчитывать', 'Оставлять следующие приемы по плану'], ['shift_all', 'Сдвигать последующие', 'Переносить расписание от фактического приема'], ['minimum_interval', 'Сохранять интервал', 'Не допускать слишком раннего следующего приема']].map(([value, label, detail]) => <button key={String(value)} className={'policy-option ' + (form.reschedulePolicy === value ? 'policy-option-active' : '')} onClick={() => update('reschedulePolicy', value)}><span className="radio-dot" /><div><strong>{label}</strong><small>{detail}</small></div></button>)}</div></Field><div className="notice notice-neutral"><ShieldCheck size={16} /><span>Приложение не рекомендует двойные дозы и не заменяет назначения врача.</span></div></div>}
        {step === 5 && <div className="modal-body">{preview && <><div className="preview-hero"><div className="preview-icon"><Check size={22} /></div><div><span className="eyebrow">ПРЕДПРОСМОТР ГОТОВ</span><h3>Расписание можно сохранить</h3><p>{preview.explanation}</p></div></div><div className="preview-times">{preview.dates.slice(0, 6).map((date) => <span key={date}><Clock3 size={13} /> {formatTime(date)}</span>)}</div>{preview.warnings.map((warning) => <div className="notice notice-warning" key={warning}><AlertTriangle size={16} /><span>{warning}</span></div>)}<div className="preview-summary"><span>Лекарство</span><strong>{form.name || 'Без названия'}</strong><span>Остаток</span><strong>{form.stockAmount} {form.stockUnit}</strong><span>Правило задержки</span><strong>{rescheduleLabel(form.reschedulePolicy as Medication['reschedulePolicy'])}</strong></div></>}</div>}
        <div className="modal-foot"><button className="button button-secondary" onClick={() => (step === 1 ? onClose() : setStep((value) => value - 1))}>{step === 1 ? 'Отмена' : 'Назад'}</button>{step < 4 && <button className="button button-primary" disabled={step === 1 && !form.name.trim()} onClick={() => setStep((value) => value + 1)}>Продолжить <ChevronRight size={15} /></button>}{step === 4 && <button className="button button-primary" onClick={() => void calculate()}>Рассчитать расписание <Zap size={15} /></button>}{step === 5 && <button className="button button-primary" disabled={isSaving} onClick={() => void save()}>{isSaving ? 'Сохранение…' : 'Сохранить лекарство'} <Check size={15} /></button>}</div>
      </div>
    </div>
  );
}

function ProfileModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const save = async () => {
    setIsSaving(true);
    try {
      await api.createProfile({ displayName: name || 'Новый профиль', type: 'relative' });
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  };
  return <div className="modal-backdrop"><div className="modal small-modal"><div className="modal-head"><div><span className="eyebrow">НОВЫЙ ПРОФИЛЬ</span><h2>Кого будем отслеживать?</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-body"><Field label="Имя профиля"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Мама" /></Field><FormHint text="Уведомления и расписание будут привязаны к этому профилю." /></div><div className="modal-foot"><button className="button button-secondary" onClick={onClose}>Отмена</button><button className="button button-primary" disabled={isSaving} onClick={() => void save()}>Создать профиль <Plus size={15} /></button></div></div></div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <em>*</em>}</span>{children}</label>;
}

function FormHint({ text }: { text: string }) {
  return <div className="form-hint"><CircleHelp size={14} /><span>{text}</span></div>;
}

function countdownLabel(value: string) {
  const delta = Math.max(0, new Date(value).getTime() - Date.now());
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return 'через ' + minutes + ' мин';
  return 'через ' + Math.floor(minutes / 60) + ' ч ' + (minutes % 60) + ' мин';
}

export default App;
