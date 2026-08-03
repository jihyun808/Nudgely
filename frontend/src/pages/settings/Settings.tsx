// pages/settings/Settings.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount, fetchSettings, updateSettings } from '@/api/settings';
import ConfirmDialog from '@/components/ConfirmDialog';
import DetailHeader from '@/components/DetailHeader';
import ErrorRetry from '@/components/ErrorRetry';
import PasswordResetModal from '@/components/PasswordResetModal';
import AccountManagementSection from '@/pages/settings/components/AccountManagementSection';
import AccountSection from '@/pages/settings/components/AccountSection';
import AppInfoSection from '@/pages/settings/components/AppInfoSection';
import NotificationSection from '@/pages/settings/components/NotificationSection';
import PasswordChangeModal from '@/pages/settings/components/PasswordChangeModal';
import PlannerSection from '@/pages/settings/components/PlannerSection';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import type { AppSettings } from '@/types/settings';

/** 열려 있는 팝업 */
type OpenDialog = 'password' | 'passwordReset' | 'logout' | 'withdraw' | null;

/**
 * 설정 화면.
 * 알림 / 기록 / 계정 / 앱 정보 / 계정 관리 다섯 묶음으로 구성된다.
 * 값은 바꾸는 즉시 화면에 반영하고 서버에 보내며, 실패하면 이전 값으로 되돌린다.
 */
export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [settings, setSettings] = useState<AppSettings>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  useEffect(() => {
    let isStale = false;
    fetchSettings()
      .then((data) => {
        if (isStale) return;
        setSettings(data);
        setHasError(false);
      })
      .catch(() => {
        if (!isStale) setHasError(true);
      })
      .finally(() => {
        if (!isStale) setIsLoading(false);
      });
    return () => {
      isStale = true;
    };
  }, [reloadKey]);

  /** 값을 먼저 화면에 반영하고 서버에 보낸다. 실패하면 이전 값으로 되돌린다 */
  const patchSettings = (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    void updateSettings(patch).catch(() => {
      setSettings(previous);
      showToast('설정을 저장하지 못했어요', { variant: 'warning' });
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/landing', { replace: true });
  };

  const handleWithdraw = async () => {
    await deleteAccount();
    logout();
    navigate('/landing', { replace: true });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background px-6 pt-6 pb-10">
      <DetailHeader title="설정" />

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-muted-foreground/8" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted-foreground/8" />
        </div>
      ) : hasError || !settings ? (
        <ErrorRetry
          message="설정을 불러오지 못했어요"
          onRetry={() => {
            setIsLoading(true);
            setHasError(false);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : (
        <>
          <NotificationSection
            notifications={settings.notifications}
            doNotDisturb={settings.doNotDisturb}
            onChangeNotifications={(notifications) => patchSettings({ notifications })}
            onChangeDoNotDisturb={(doNotDisturb) => patchSettings({ doNotDisturb })}
          />

          <PlannerSection
            planner={settings.planner}
            onChange={(planner) => patchSettings({ planner })}
          />

          <AccountSection
            email={user?.email}
            linkedProviders={settings.linkedProviders}
            onChangePassword={() => setOpenDialog('password')}
          />

          <AppInfoSection />

          <AccountManagementSection
            onLogout={() => setOpenDialog('logout')}
            onWithdraw={() => setOpenDialog('withdraw')}
          />
        </>
      )}

      {openDialog === 'password' && (
        <PasswordChangeModal
          onClose={() => setOpenDialog(null)}
          onForgotPassword={() => setOpenDialog('passwordReset')}
        />
      )}

      {openDialog === 'passwordReset' && (
        <PasswordResetModal defaultEmail={user?.email} onClose={() => setOpenDialog(null)} />
      )}

      {openDialog === 'logout' && (
        <ConfirmDialog
          title="로그아웃할까요?"
          description="다시 이용하려면 로그인해야 해요."
          confirmLabel="로그아웃"
          onConfirm={handleLogout}
          onClose={() => setOpenDialog(null)}
        />
      )}

      {openDialog === 'withdraw' && (
        <ConfirmDialog
          title="정말 탈퇴할까요?"
          description="목표와 대화, 기록이 모두 삭제되고 되돌릴 수 없어요."
          confirmLabel="탈퇴하기"
          isDestructive
          onConfirm={handleWithdraw}
          onClose={() => setOpenDialog(null)}
        />
      )}
    </div>
  );
}
