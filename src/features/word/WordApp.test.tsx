import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WordApp } from './WordApp';

const upsertCard = vi.fn();
const removeCard = vi.fn();
const createFolder = vi.fn();
const moveFolder = vi.fn();
const removeFolder = vi.fn();

async function openDirectoryPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '編集ディレクトリを開く' }));
}

vi.mock('./hooks/useCards', () => ({
  useCards: () => ({
    cards: [
      {
        id: '1',
        frontText: 'Hello',
        backText: 'こんにちは',
        folderId: 'root',
        status: 'new',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        frontText: 'Persist',
        backText: '保存する',
        folderId: 'english',
        status: 'weak',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
      {
        id: '3',
        frontText: 'Past tense',
        backText: '過去形',
        folderId: 'tense',
        status: 'learning',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
      },
    ],
    folders: [
      { id: 'root', name: 'トップ', parentId: null, createdAt: '1970-01-01T00:00:00.000Z' },
      { id: 'english', name: '英単語', parentId: null, createdAt: '2024-01-03T00:00:00.000Z' },
      { id: 'grammar', name: '文法', parentId: 'root', createdAt: '2024-01-04T00:00:00.000Z' },
      { id: 'tense', name: '時制', parentId: 'english', createdAt: '2024-01-05T00:00:00.000Z' },
    ],
    loading: false,
    upsertCard,
    removeCard,
    createFolder,
    moveFolder,
    removeFolder,
  }),
}));

describe('App', () => {
  beforeEach(() => {
    upsertCard.mockReset();
    upsertCard.mockImplementation(async (input) => ({ card: { ...input, id: 'created-card' } }));
    removeCard.mockReset();
    removeCard.mockResolvedValue(undefined);
    createFolder.mockReset();
    createFolder.mockResolvedValue(undefined);
    moveFolder.mockReset();
    moveFolder.mockResolvedValue(undefined);
    removeFolder.mockReset();
    removeFolder.mockResolvedValue({
      folder: { id: 'english', name: '英単語', parentId: null, createdAt: '2024-01-03T00:00:00.000Z' },
      folderIds: new Set(['english', 'tense']),
    });
  });

  it('renders the study card', () => {
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('word-app')).toBeInTheDocument();
    expect(screen.queryByLabelText('ログインユーザー')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '学習' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getAllByText('トップ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未履修').length).toBeGreaterThan(0);
  });

  it('hides the edit navigation link on the edit page', () => {
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '学習' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '編集' })).not.toBeInTheDocument();
  });

  it('opens the study sidebar from the header button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '学習設定を開く' }));

    expect(screen.getByLabelText('学習設定')).toHaveClass('open');
    expect(screen.getByRole('button', { name: '学習設定を開く' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the edit directory sidebar from the header button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '編集ディレクトリを開く' }));

    expect(screen.getByLabelText('編集ディレクトリ')).toHaveClass('open');
    expect(screen.getByRole('button', { name: '編集ディレクトリを開く' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows top-level folders with null and root parent ids', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);

    expect(screen.getByRole('button', { name: '英単語' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文法' })).toBeInTheDocument();
  });

  it('moves to the next card from the arrow button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('次のカード'));

    expect(screen.getByText('Persist')).toBeInTheDocument();
    expect(screen.getAllByText('英単語').length).toBeGreaterThan(0);
  });

  it('wraps from the first study card to the last with the previous button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('前のカード'));

    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('wraps from the last study card to the first with the next button', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText('次のカード'));
    await user.click(screen.getByLabelText('次のカード'));
    await user.click(screen.getByLabelText('次のカード'));

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('seeks to a study card from the range control', () => {
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('カード位置'), { target: { value: '2' } });

    expect(screen.getByText('Persist')).toBeInTheDocument();
  });

  it('flips the study card when clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const studyCard = screen.getByRole('button', { pressed: false });
    await user.click(studyCard);

    expect(studyCard).toHaveAttribute('aria-pressed', 'true');
    expect(studyCard).toHaveClass('flipped');
  });

  it('creates a card in the currently displayed folder', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('表示するディレクトリ'), 'english');
    await user.type(screen.getByLabelText('表面'), 'Apple');
    await user.type(screen.getByLabelText('裏面'), 'りんご');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語');
    expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Apple', backText: 'りんご', folderId: 'english' }, undefined);
  });

  it('moves to the registered card directory after creating a card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('表面'), 'Apple');
    await user.type(screen.getByLabelText('裏面'), 'りんご');
    await user.selectOptions(screen.getByLabelText('ディレクトリ'), 'english');
    await user.click(screen.getByRole('button', { name: '登録' }));

    await waitFor(() => {
      expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語');
    });
  });

  it('does not show status selection when creating a card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('表面'), 'Apple');

    expect(screen.queryByLabelText('ステータス')).not.toBeInTheDocument();
  });

  it('creates a folder inside the currently displayed folder', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByRole('button', { name: '英単語' }));
    await user.type(screen.getByLabelText('新しいディレクトリ名'), '動詞');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(createFolder).toHaveBeenCalledWith('動詞', 'english');
  });

  it('moves a folder into another folder', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByLabelText('英単語の移動先を開く'));
    await user.click(screen.getByRole('menuitem', { name: '文法' }));

    expect(moveFolder).toHaveBeenCalledWith('english', 'grammar');
  });

  it('deletes a folder after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByRole('button', { name: '英単語を削除' }));

    const dialog = screen.getByRole('dialog', { name: 'ディレクトリ削除' });
    expect(dialog).toHaveTextContent('サブディレクトリ1件');
    expect(dialog).toHaveTextContent('カード2枚');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));

    expect(removeFolder).toHaveBeenCalledWith('english');
  });

  it('changes study cards from the directory select without showing folder creation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('新しいディレクトリ名')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('表示するディレクトリ'), 'english');

    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語');
    expect(screen.getByText('Persist')).toBeInTheDocument();
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('includes nested directory cards when filtering by a parent directory', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('表示するディレクトリ'), 'english');

    expect(screen.getByText('Persist')).toBeInTheDocument();
    await user.click(screen.getByLabelText('次のカード'));
    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('filters study cards by status separately from directory', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('表示するステータス'), 'weak');

    expect(screen.getByText('Persist')).toBeInTheDocument();
    expect(screen.getAllByText('間違えやすい').length).toBeGreaterThan(0);
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('updates a card status from the edit form', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'カード編集' });
    await user.selectOptions(within(dialog).getByLabelText('ステータス'), 'mastered');
    await user.click(within(dialog).getByRole('button', { name: '更新' }));

    expect(upsertCard).toHaveBeenCalledWith(
      { frontText: 'Hello', backText: 'こんにちは', folderId: 'root', status: 'mastered' },
      '1',
    );
  });

  it('opens a delete confirmation dialog before deleting a card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'カード削除' });

    expect(dialog).toHaveTextContent('Hello');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));

    expect(removeCard).toHaveBeenCalledWith('1');
  });

  it('shows the selected study directory as breadcrumbs in the header', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('表示するディレクトリ'), 'tense');

    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語 - 時制');
  });

  it('changes the displayed study directory from header breadcrumbs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('表示するディレクトリ'), 'tense');
    await user.click(screen.getByRole('button', { name: '英単語' }));

    expect(screen.getByLabelText('表示するディレクトリ')).toHaveValue('english');
    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語');
    expect(screen.getByText('Persist')).toBeInTheDocument();
  });

  it('shows the selected edit directory as breadcrumbs in the header', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByRole('button', { name: '英単語' }));
    await user.click(screen.getByRole('button', { name: '∟時制' }));

    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語 - 時制');
  });

  it('changes the displayed edit directory from header breadcrumbs', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByRole('button', { name: '英単語' }));
    await user.click(screen.getByRole('button', { name: '∟時制' }));
    await user.click(within(screen.getByLabelText('現在のディレクトリ')).getByRole('button', { name: '英単語' }));

    expect(screen.getByLabelText('現在のディレクトリ')).toHaveTextContent('英単語');
    expect(screen.getByText('Persist')).toBeInTheDocument();
    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('includes nested directory cards when filtering edit cards by a parent directory', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await openDirectoryPanel(user);
    await user.click(screen.getByRole('button', { name: '英単語' }));

    expect(screen.getByText('Persist')).toBeInTheDocument();
    expect(screen.getByText('Past tense')).toBeInTheDocument();
  });

  it('sorts edit cards by the selected field and direction', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('並び替え'), 'frontText');
    await user.selectOptions(screen.getByLabelText('順序'), 'desc');

    const cardTitles = Array.from(container.querySelectorAll('.card-list .list-card strong')).map((item) => item.textContent);
    expect(cardTitles).toEqual(['Persist', 'Past tense', 'Hello']);
  });

  it('shows pagination controls for edit cards', () => {
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('表示件数')).toHaveValue('10');
    expect(screen.getByText('1-3件 / 3件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  it('shows nested directories in select options', () => {
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('option', { name: '英単語' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: '∟時制' }).length).toBeGreaterThan(0);
  });

  it('updates the current card directory from the card badge select', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('カードのディレクトリ'), 'english');

    expect(upsertCard).toHaveBeenCalledWith(
      { frontText: 'Hello', backText: 'こんにちは', folderId: 'english', status: 'new' },
      '1',
    );
  });

  it('shows card directory names without hierarchy markers inside cards', () => {
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    const cardDirectorySelect = screen.getByLabelText('カードのディレクトリ') as unknown as HTMLSelectElement;
    const nestedDirectoryOption = cardDirectorySelect.querySelector('option[value="tense"]');

    expect(nestedDirectoryOption).toHaveTextContent('時制');
    expect(nestedDirectoryOption).not.toHaveTextContent('∟');
  });

  it('updates the current card status from the card badge select', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('カードのステータス'), 'mastered');

    expect(upsertCard).toHaveBeenCalledWith(
      { frontText: 'Hello', backText: 'こんにちは', folderId: 'root', status: 'mastered' },
      '1',
    );
  });

  it('imports cards from a CSV file and creates missing directories', async () => {
    const user = userEvent.setup();
    createFolder.mockResolvedValue({ id: 'verb', name: '動詞', parentId: 'english', createdAt: '2024-01-05T00:00:00.000Z' });

    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const file = new File(['front,back,directory\nApple,りんご,英単語\nRun,走る,英単語/動詞\n'], 'words.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('CSVファイル'), file);
    await screen.findByText('Apple');
    await user.click(screen.getByRole('button', { name: '取り込む' }));

    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith('動詞', 'english');
      expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Apple', backText: 'りんご', folderId: 'english', status: undefined });
      expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Run', backText: '走る', folderId: 'verb', status: undefined });
    });
  });

  it('imports exported CSV columns with status and slash directories', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const file = new File(
      ['front,back,directory,status,createdAt,updatedAt\nReview,復習,英単語/時制,mastered,2024-01-04T00:00:00.000Z,2024-01-04T00:00:00.000Z\nRoot,ルート,,weak,,\n'],
      'word-app-export.csv',
      { type: 'text/csv' },
    );
    await user.upload(screen.getByLabelText('CSVファイル'), file);
    await screen.findByText('Review');
    await user.click(screen.getByRole('button', { name: '取り込む' }));

    await waitFor(() => {
      expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Review', backText: '復習', folderId: 'tense', status: 'mastered' });
      expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Root', backText: 'ルート', folderId: 'root', status: 'weak' });
    });
  });

  it('skips duplicate words when importing CSV rows', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const file = new File(['front,back,directory\nHello,ハロー,\nRun,走る,\nRun,走ります,\n'], 'words.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('CSVファイル'), file);
    await screen.findByText('登録しない重複ワード');
    await user.click(screen.getByRole('button', { name: '取り込む' }));

    await waitFor(() => {
      expect(upsertCard).toHaveBeenCalledTimes(1);
      expect(upsertCard).toHaveBeenCalledWith({ frontText: 'Run', backText: '走る', folderId: 'root', status: undefined });
      expect(screen.getAllByText(/重複 2件はスキップしました/).length).toBeGreaterThan(0);
    });
  });

  it('shows a snackbar after creating a card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/cards']}>
        <WordApp idToken={null} onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('表面'), 'Apple');
    await user.type(screen.getByLabelText('裏面'), 'りんご');
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(screen.getByRole('status')).toHaveTextContent('カードを登録しました。');
  });
});

