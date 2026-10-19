import { test, expect } from '@playwright/test';

test.describe('Componentes de UI (vitrine /test-ui)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-ui');
    await expect(page.getByRole('heading', { name: 'Vitrine de componentes', level: 1 })).toBeVisible();
  });

  test('dialog tem nome acessível igual ao título', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir modal' }).click();
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toBeVisible();
  });

  test('Esc fecha só o modal do topo', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir modal' }).click();
    await page.getByRole('button', { name: 'Abrir segundo modal' }).click();
    await expect(page.getByRole('dialog', { name: 'Segundo modal' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Segundo modal' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toHaveCount(0);
  });

  test('foco volta ao gatilho ao fechar', async ({ page }) => {
    const gatilho = page.getByRole('button', { name: 'Abrir modal' });
    await gatilho.click();
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });

  test('ConfirmDialog só libera com o texto exato', async ({ page }) => {
    await page.getByRole('button', { name: 'Excluir competição' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Excluir competição' });
    await expect(dialogo).toBeVisible();
    const botao = page.getByTestId('btn-confirmar-exclusao');
    const campo = page.getByTestId('input-confirmacao-exclusao');
    await expect(botao).toBeDisabled();
    await campo.fill('copa municipal');
    await expect(botao).toBeDisabled();
    await campo.fill('Copa Municipal');
    await expect(botao).toBeEnabled();
    await botao.click();
    await expect(page.getByTestId('resultado-confirmacao')).toHaveText('Confirmado');
  });

  test('ConfirmDialog mostra erro do onConfirm dentro do modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Excluir com falha' }).click();
    await page.getByTestId('btn-confirmar-exclusao').click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Falha simulada');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('tabs navegam por seta e ativam com Enter', async ({ page }) => {
    const geral = page.getByRole('tab', { name: 'Visão geral' });
    await geral.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Jogos' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Jogos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('Conteúdo de Jogos');
  });

  test('menu suspenso fecha ao escolher item', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByTestId('ultima-acao')).toHaveText('Editar');
  });

  test('tabela larga rola dentro do card a 390px sem rolagem horizontal da página', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/test-ui');
    const tabela = page.getByTestId('tabela-larga');
    await expect(tabela).toBeVisible();
    const medidas = await page.evaluate(() => {
      const doc = document.documentElement;
      const wrap = document.querySelector('[data-testid="tabela-larga"] table')!.parentElement!;
      return {
        paginaLargura: doc.scrollWidth,
        janela: window.innerWidth,
        wrapScroll: wrap.scrollWidth,
        wrapCliente: wrap.clientWidth,
      };
    });
    expect(medidas.paginaLargura).toBeLessThanOrEqual(medidas.janela);
    expect(medidas.wrapScroll).toBeGreaterThan(medidas.wrapCliente);
  });

  test('modal fecha por clique fora e pelo botão ×', async ({ page }) => {
    const gatilho = page.getByRole('button', { name: 'Abrir modal' });
    await gatilho.click();
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await gatilho.click();
    await expect(page.getByRole('dialog', { name: 'Modal de exemplo' })).toBeVisible();
    await page.mouse.click(3, 3);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('menu tem Excluir como último item, depois de um separador', async ({ page }) => {
    await page.getByRole('button', { name: 'Mais ações' }).click();
    const itens = page.getByRole('menuitem');
    await expect(itens.last()).toHaveText('Excluir');
    await expect(page.getByRole('menu').getByRole('separator')).toHaveCount(1);
    const ordem = await page.getByRole('menu').evaluate((menu) =>
      Array.from(menu.children).map((el) => el.getAttribute('role')),
    );
    expect(ordem).toEqual(['menuitem', 'menuitem', 'separator', 'menuitem']);
  });

  test('ConfirmDialog fecha depois de confirmar com sucesso', async ({ page }) => {
    await page.getByRole('button', { name: 'Excluir competição' }).click();
    await page.getByTestId('input-confirmacao-exclusao').fill('Copa Municipal');
    await page.getByTestId('btn-confirmar-exclusao').click();
    await expect(page.getByTestId('resultado-confirmacao')).toHaveText('Confirmado');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('isolamento do legado: tema escuro mantém as cores dos tokens', async ({ page }) => {
    await page.getByRole('button', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const cores = await page.evaluate(() => {
      const h2 = document.createElement('h2');
      h2.className = 'text-fg-muted';
      h2.textContent = 'Título isolado';
      const input = document.createElement('input');
      input.className = 'bg-surface text-fg';
      const raiz = document.querySelector('[data-ui]')!;
      raiz.append(h2, input);
      const ref = document.createElement('div');
      ref.className = 'text-fg-muted';
      const refInput = document.createElement('div');
      refInput.className = 'bg-surface text-fg';
      raiz.append(ref, refInput);
      const c = (el: Element, prop: 'color' | 'backgroundColor') => getComputedStyle(el)[prop];
      const r = {
        h2: c(h2, 'color'),
        h2Esperado: c(ref, 'color'),
        inputCor: c(input, 'color'),
        inputFundo: c(input, 'backgroundColor'),
        inputCorEsperada: c(refInput, 'color'),
        inputFundoEsperado: c(refInput, 'backgroundColor'),
      };
      h2.remove(); input.remove(); ref.remove(); refInput.remove();
      return r;
    });
    expect(cores.h2).toBe(cores.h2Esperado);
    expect(cores.inputCor).toBe(cores.inputCorEsperada);
    expect(cores.inputFundo).toBe(cores.inputFundoEsperado);
  });

  test('isolamento do legado em portal: Input e título do modal mantêm as cores dos tokens', async ({ page }) => {
    await page.getByRole('button', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Modal com campo (abrir)' }).click();
    // aguarda o fim das transições de cor da troca de tema antes de medir
    await page.waitForTimeout(500);
    const dialogo = page.getByRole('dialog', { name: 'Modal com campo' });
    await expect(dialogo).toBeVisible();
    const r = await page.evaluate(() => {
      const estilo = (el: Element) => {
        const c = getComputedStyle(el);
        return { cor: c.color, fundo: c.backgroundColor, borda: c.borderTopColor };
      };
      const campo = document.querySelector('[data-testid="campo-modal"]')!;
      const titulo = document.querySelector('[role="dialog"] h2')!;
      // Referências com as mesmas classes, dentro da raiz [data-ui] da vitrine.
      const raiz = document.querySelector('main[data-ui]')!;
      const refCampo = raiz.querySelector('#v-nome')!;
      const refTitulo = document.createElement('div');
      refTitulo.className = 'text-fg';
      raiz.append(refTitulo);
      const resultado = {
        campo: estilo(campo),
        campoRef: estilo(refCampo),
        titulo: estilo(titulo).cor,
        tituloRef: estilo(refTitulo).cor,
      };
      refTitulo.remove();
      return resultado;
    });
    expect(r.campo.fundo).toBe(r.campoRef.fundo);
    expect(r.campo.borda).toBe(r.campoRef.borda);
    expect(r.campo.cor).toBe(r.campoRef.cor);
    expect(r.campo.fundo).not.toBe('rgba(3, 7, 18, 0.6)');
    expect(r.campo.borda).not.toBe('rgba(255, 255, 255, 0.1)');
    expect(r.titulo).toBe(r.tituloRef);
  });
});
