import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/ui-store';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      sidebarCollapsed: false,
      activeModal: null,
      searchOpen: false,
      toasts: [],
    });
  });

  describe('Sidebar', () => {
    it('toggles sidebar state', () => {
      const { toggleSidebar, sidebarCollapsed } = useUIStore.getState();

      expect(sidebarCollapsed).toBe(false);

      toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('sets sidebar collapsed state', () => {
      const { setSidebarCollapsed } = useUIStore.getState();

      setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('Modals', () => {
    it('opens and closes modals', () => {
      const { openModal, closeModal, activeModal } = useUIStore.getState();

      expect(activeModal).toBe(null);

      openModal('test-modal');
      expect(useUIStore.getState().activeModal).toBe('test-modal');

      closeModal();
      expect(useUIStore.getState().activeModal).toBe(null);
    });

    it('replaces active modal when opening a new one', () => {
      const { openModal } = useUIStore.getState();

      openModal('modal-1');
      expect(useUIStore.getState().activeModal).toBe('modal-1');

      openModal('modal-2');
      expect(useUIStore.getState().activeModal).toBe('modal-2');
    });
  });

  describe('Search', () => {
    it('opens and closes search', () => {
      const { setSearchOpen } = useUIStore.getState();

      expect(useUIStore.getState().searchOpen).toBe(false);

      setSearchOpen(true);
      expect(useUIStore.getState().searchOpen).toBe(true);

      setSearchOpen(false);
      expect(useUIStore.getState().searchOpen).toBe(false);
    });
  });

  describe('Toasts', () => {
    it('adds toast to queue', () => {
      const { addToast, toasts } = useUIStore.getState();

      expect(toasts).toHaveLength(0);

      addToast('Test message', 'info');
      const state = useUIStore.getState();

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].message).toBe('Test message');
      expect(state.toasts[0].type).toBe('info');
      expect(state.toasts[0].id).toBeDefined();
    });

    it('removes toast from queue', () => {
      const { addToast, removeToast } = useUIStore.getState();

      addToast('Test message', 'success');
      const toastId = useUIStore.getState().toasts[0].id;

      expect(useUIStore.getState().toasts).toHaveLength(1);

      removeToast(toastId);
      expect(useUIStore.getState().toasts).toHaveLength(0);
    });

    it('adds multiple toasts', () => {
      const { addToast } = useUIStore.getState();

      addToast('Message 1', 'info');
      addToast('Message 2', 'success');
      addToast('Message 3', 'error');

      const state = useUIStore.getState();
      expect(state.toasts).toHaveLength(3);
      expect(state.toasts[0].message).toBe('Message 1');
      expect(state.toasts[1].message).toBe('Message 2');
      expect(state.toasts[2].message).toBe('Message 3');
    });
  });
});
