import { create } from 'zustand';
import type { Todo } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { generateId } from '../utils/idUtils';

interface TodoState {
  todos: Todo[];

  addTodo: (todo: Omit<Todo, 'id' | 'createdAt'>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  clearCompleted: () => void;
  initialize: (todos: Todo[]) => void;
  setTodos: (todos: Todo[]) => void;
}

const initialState: Omit<TodoState, 'addTodo' | 'toggleTodo' | 'deleteTodo' | 'updateTodo' | 'clearCompleted' | 'initialize' | 'setTodos'> = {
  todos: [],
};

export const useTodoStore = create<TodoState>((set) => ({
  ...initialState,

  addTodo: (todo) => {
    const newTodo: Todo = {
      ...todo,
      id: generateId('todo-'),
      createdAt: Date.now(),
    };
    set((state) => ({ todos: [...state.todos, newTodo] }));
  },

  toggleTodo: (id) => {
    set((state) => ({
      todos: state.todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ),
    }));
  },

  deleteTodo: (id) => {
    set((state) => ({
      todos: state.todos.filter(todo => todo.id !== id),
    }));
  },

  updateTodo: (id, updates) => {
    set((state) => ({
      todos: state.todos.map(todo =>
        todo.id === id ? { ...todo, ...updates } : todo
      ),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      todos: state.todos.filter(todo => !todo.completed),
    }));
  },

  initialize: (todos) => {
    if (todos != null) {
      set({ todos });
    }
  },

  setTodos: (todos) => {
    set({ todos });
  },
}));

setupAutoPersist(useTodoStore, [
  { key: 'todos', persist: (v) => getServices().dataManager.updateTodos(v as Todo[]) },
]);