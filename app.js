  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
  import { getDatabase, ref, push, set, onValue, remove, update, get, child } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyAQHAmOY8nSMxFHJ0oRoe-QROZOkwsWAUY",
    authDomain: "todo-windsurf.firebaseapp.com",
    projectId: "todo-windsurf",
    storageBucket: "todo-windsurf.firebasestorage.app",
    messagingSenderId: "462093256164",
    appId: "1:462093256164:web:eaaa267a044acea5d633f1",
    databaseURL: "https://todo-windsurf-default-rtdb.asia-southeast1.firebasedatabase.app/"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const auth = getAuth(app);

// 로컬 스토리지 기반 Todo 관리 시스템
class LocalTodoManager {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        this.todos = this.loadTodos();
        console.log('LocalTodoManager 초기화됨, 할 일 수:', this.todos.length);
    }

    // 사용자별 할 일 목록 로드
    loadTodos() {
        if (!this.currentUser) return [];
        
        const userTodos = localStorage.getItem(`todos_${this.currentUser.uid}`);
        return userTodos ? JSON.parse(userTodos) : [];
    }

    // 할 일 목록 저장
    saveTodos() {
        if (!this.currentUser) return;
        
        localStorage.setItem(`todos_${this.currentUser.uid}`, JSON.stringify(this.todos));
    }

    // 할 일 추가
    addTodo(text) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const newTodo = {
            id: 'todo_' + Date.now(),
            text,
            completed: false,
            createdAt: new Date().toISOString(),
            userName: this.currentUser.displayName || this.currentUser.email || '사용자'
        };
        
        this.todos.unshift(newTodo); // 최신 항목을 맨 위에 추가
        this.saveTodos();
        
        return Promise.resolve(newTodo);
    }

    // 할 일 상태 변경
    toggleTodoCompleted(id, completed) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoIndex = this.todos.findIndex(todo => todo.id === id);
        if (todoIndex === -1) return Promise.reject('할 일을 찾을 수 없습니다');
        
        this.todos[todoIndex].completed = completed;
        this.saveTodos();
        
        return Promise.resolve();
    }

    // 할 일 수정
    updateTodo(id, text) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoIndex = this.todos.findIndex(todo => todo.id === id);
        if (todoIndex === -1) return Promise.reject('할 일을 찾을 수 없습니다');
        
        this.todos[todoIndex].text = text;
        this.saveTodos();
        
        return Promise.resolve();
    }

    // 할 일 삭제
    deleteTodo(id) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoIndex = this.todos.findIndex(todo => todo.id === id);
        if (todoIndex === -1) return Promise.reject('할 일을 찾을 수 없습니다');
        
        this.todos.splice(todoIndex, 1);
        this.saveTodos();
        
        return Promise.resolve();
    }

    // 선택된 항목 삭제 (완료된 항목 삭제에서 변경)
    deleteSelected() {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        this.todos = this.todos.filter(todo => !todo.completed);
        this.saveTodos();
        
        return Promise.resolve();
    }

    // 사용자 상태 변경 감지
    onAuthStateChanged(callback) {
        // 초기 호출
        callback(this.currentUser);
        
        // 로컬 스토리지 변경 감지
        window.addEventListener('storage', (event) => {
            if (event.key === 'currentUser') {
                this.currentUser = JSON.parse(event.newValue || 'null');
                this.todos = this.loadTodos();
                callback(this.currentUser);
            }
        });
    }

    // 로그아웃
    signOut() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        return Promise.resolve();
    }
}

// Firebase Realtime Database 기반 Todo 관리 시스템
class FirebaseTodoManager {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        this.todos = [];
        this.db = database;
        this.todosRef = null;
        
        if (this.currentUser) {
            this.todosRef = ref(this.db, `todos/${this.currentUser.uid}`);
            this.loadTodos();
        }
        
        console.log('FirebaseTodoManager 초기화됨');
    }

    // 사용자별 할 일 목록 로드
    loadTodos() {
        if (!this.currentUser) return [];
        
        this.todosRef = ref(this.db, `todos/${this.currentUser.uid}`);
        
        // 실시간 데이터 리스닝
        onValue(this.todosRef, (snapshot) => {
            this.todos = [];
            snapshot.forEach((childSnapshot) => {
                const todo = childSnapshot.val();
                todo.id = childSnapshot.key;
                this.todos.push(todo);
            });
            
            // 최신 항목이 맨 위에 오도록 정렬
            this.todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // 이벤트 발생 (UI 업데이트를 위해)
            const event = new CustomEvent('todos-updated');
            window.dispatchEvent(event);
        });
    }

    // 할 일 추가
    addTodo(text) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const newTodo = {
            text,
            completed: false,
            createdAt: new Date().toISOString(),
            userName: this.currentUser.displayName || this.currentUser.email || 'jwj1206'
        };
        
        // Firebase에 새 할 일 추가
        const newTodoRef = push(this.todosRef);
        return set(newTodoRef, newTodo);
    }

    // 할 일 상태 변경
    toggleTodoCompleted(id, completed) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoRef = ref(this.db, `todos/${this.currentUser.uid}/${id}`);
        return update(todoRef, { completed });
    }

    // 할 일 수정
    updateTodo(id, text) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoRef = ref(this.db, `todos/${this.currentUser.uid}/${id}`);
        return update(todoRef, { text });
    }

    // 할 일 삭제
    deleteTodo(id) {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const todoRef = ref(this.db, `todos/${this.currentUser.uid}/${id}`);
        return remove(todoRef);
    }

    // 선택된 항목 삭제 (완료된 항목 삭제)
    deleteSelected() {
        if (!this.currentUser) return Promise.reject('로그인이 필요합니다');
        
        const promises = this.todos
            .filter(todo => todo.completed)
            .map(todo => this.deleteTodo(todo.id));
        
        return Promise.all(promises);
    }

    // 사용자 상태 변경 감지
    onAuthStateChanged(callback) {
        // 초기 호출
        callback(this.currentUser);
        
        // 로컬 스토리지 변경 감지
        window.addEventListener('storage', (event) => {
            if (event.key === 'currentUser') {
                this.currentUser = JSON.parse(event.newValue || 'null');
                
                if (this.currentUser) {
                    this.todosRef = ref(this.db, `todos/${this.currentUser.uid}`);
                    this.loadTodos();
                } else {
                    this.todos = [];
                }
                
                callback(this.currentUser);
            }
        });
    }

    // 로그아웃
    signOut() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        // Firebase Authentication에서도 로그아웃
        return signOut(auth).then(() => {
            console.log('Firebase 로그아웃 성공');
            return Promise.resolve();
        }).catch(error => {
            console.error('Firebase 로그아웃 오류:', error);
            return Promise.resolve(); // 오류가 있어도 로컬 로그아웃은 진행
        });
    }
}

// Firebase Authentication 기반 인증 시스템
class FirebaseAuth {
    constructor() {
        this.auth = auth;
        this.currentUser = null;
        
        // 현재 로그인된 사용자 확인
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                // 사용자 정보를 로컬 스토리지에도 저장 (기존 코드와의 호환성 유지)
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'jwj1206'
                };
                localStorage.setItem('currentUser', JSON.stringify(userData));
                this.currentUser = userData;
                console.log('Firebase 인증: 로그인됨', user.email);
            } else {
                localStorage.removeItem('currentUser');
                this.currentUser = null;
                console.log('Firebase 인증: 로그인되지 않음');
            }
        });
        
        console.log('FirebaseAuth 초기화됨');
    }

    // 사용자 상태 변경 이벤트 리스너
    onAuthStateChanged(callback) {
        return this.auth.onAuthStateChanged((user) => {
            if (user) {
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'jwj1206'
                };
                this.currentUser = userData;
                callback(userData);
            } else {
                this.currentUser = null;
                callback(null);
            }
        });
    }

    // 로그인
    signInWithEmailAndPassword(email, password) {
        return signInWithEmailAndPassword(this.auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'jwj1206'
                };
                this.currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(userData));
                return userData;
            });
    }

    // 회원가입
    createUserWithEmailAndPassword(email, password, displayName) {
        return createUserWithEmailAndPassword(this.auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                
                // 사용자 프로필 업데이트 (displayName 설정)
                return updateProfile(user, {
                    displayName: displayName || 'jwj1206'
                }).then(() => {
                    const userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || 'jwj1206'
                    };
                    this.currentUser = userData;
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    return userData;
                });
            });
    }

    // 로그아웃
    signOut() {
        return signOut(this.auth).then(() => {
            localStorage.removeItem('currentUser');
            this.currentUser = null;
        });
    }
}

// 페이지 확인 및 적절한 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('페이지 로드됨:', window.location.pathname);
    
    // 다크모드 초기화
    initDarkMode();
    
    // 현재 페이지 확인 및 초기화
    const currentPath = window.location.pathname;
    if (currentPath.includes('auth.html')) {
        initAuthPage();
    } else if (currentPath.includes('index.html') || currentPath === '/' || currentPath === '') {
        initIndexPage();
    }
});

// 다크모드 초기화
function initDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    // 저장된 테마 적용
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = ''; // 달 이모지 (다크 모드에서는 라이트 모드로 전환하는 버튼)
    } else {
        themeToggle.innerHTML = ''; // 해 이모지 (라이트 모드에서는 다크 모드로 전환하는 버튼)
    }
    
    // 테마 전환 이벤트
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = ''; // 달 이모지
        } else {
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = ''; // 해 이모지
        }
    });
}

// 인증 페이지 초기화
function initAuthPage() {
    console.log('인증 페이지 초기화');
    
    // Firebase 인증 객체 생성 (LocalAuth 대신 FirebaseAuth 사용)
    const authManager = new FirebaseAuth();
    
    // DOM 요소
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginAuthForm = document.getElementById('login-auth-form');
    const signupAuthForm = document.getElementById('signup-auth-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const signupUsername = document.getElementById('signup-username'); // 사용자 이름 필드 추가
    const signupName = document.getElementById('signup-name');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const showSignup = document.getElementById('show-signup');
    const showLogin = document.getElementById('show-login');
    
    // 콘솔에 디버그 정보 출력
    console.log('DOM 요소 초기화 완료');
    
    // 이미 로그인한 사용자 확인
    authManager.onAuthStateChanged(user => {
        if (user) {
            console.log('이미 로그인된 사용자:', user.email);
            window.location.href = 'index.html';
        } else {
            console.log('로그인되지 않은 상태');
        }
    });
    
    // 로그인/회원가입 폼 전환
    showSignup.addEventListener('click', () => {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    });
    
    showLogin.addEventListener('click', () => {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    
    // 로그인 폼 제출 이벤트
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        
        if (!email || !password) {
            loginError.textContent = '이메일과 비밀번호를 모두 입력해주세요.';
            return;
        }
        
        loginError.textContent = '';
        console.log('로그인 시도:', email);
        
        // 로그인 버튼 비활성화 및 로딩 표시
        const loginButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = loginButton.textContent;
        loginButton.disabled = true;
        loginButton.textContent = '로그인 중...';
        
        authManager.signInWithEmailAndPassword(email, password)
            .then(user => {
                console.log('로그인 성공:', user.email);
                window.location.href = 'index.html';
            })
            .catch(error => {
                console.error('로그인 오류:', error);
                
                // 로그인 버튼 복원
                loginButton.disabled = false;
                loginButton.textContent = originalButtonText;
                
                if (error.code === 'auth/user-not-found') {
                    loginError.textContent = '등록되지 않은 이메일입니다.';
                } else if (error.code === 'auth/wrong-password') {
                    loginError.textContent = '비밀번호가 일치하지 않습니다.';
                } else if (error.code === 'auth/invalid-credential') {
                    loginError.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
                } else if (error.code === 'auth/invalid-email') {
                    loginError.textContent = '유효하지 않은 이메일 형식입니다.';
                } else {
                    loginError.textContent = '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
                    console.error('상세 오류:', error);
                }
            });
    });
    
    // 회원가입 이벤트
    signupAuthForm.addEventListener('submit', event => {
        event.preventDefault();
        
        const email = signupEmail.value.trim();
        const password = signupPassword.value.trim();
        const username = signupUsername.value.trim() || 'jwj1206';
        const name = signupName.value.trim();
        
        if (!email || !password || !username) {
            signupError.textContent = '필수 항목을 모두 입력해주세요.';
            return;
        }
        
        if (password.length < 6) {
            signupError.textContent = '비밀번호는 6자 이상이어야 합니다.';
            return;
        }
        
        signupError.textContent = '';
        
        authManager.createUserWithEmailAndPassword(email, password, username)
            .then(() => {
                console.log('회원가입 성공, 메인 페이지로 이동');
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('회원가입 오류:', error);
                
                if (error.code === 'auth/email-already-in-use') {
                    signupError.textContent = '이미 사용 중인 이메일입니다.';
                } else if (error.code === 'auth/invalid-email') {
                    signupError.textContent = '유효하지 않은 이메일 형식입니다.';
                } else if (error.code === 'auth/weak-password') {
                    signupError.textContent = '비밀번호가 너무 약합니다.';
                } else {
                    signupError.textContent = '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.';
                }
            });
    });
}

// 메인 페이지 초기화
function initIndexPage() {
    console.log('메인 페이지 초기화');
    
    // Firebase Todo 관리 객체 생성 (LocalTodoManager 대신 FirebaseTodoManager 사용)
    const todoManager = new FirebaseTodoManager();
    
    // DOM 요소
    const todoInput = document.getElementById('todo-input');
    const addTodoButton = document.getElementById('add-todo-button');
    const todoList = document.getElementById('todo-list');
    const filterSelect = document.getElementById('filter-select');
    const deleteSelectedButton = document.getElementById('delete-selected-button'); // 이름 변경
    const itemsLeft = document.getElementById('items-left');
    const userName = document.getElementById('user-name');
    const logoutButton = document.getElementById('logout-button');
    const todoItemTemplate = document.getElementById('todo-item-template');
    
    // 현재 필터 상태
    let currentFilter = 'all';
    
    // 로그아웃 버튼 스타일 적용 - 와인색 배경
    if (logoutButton) {
        logoutButton.style.backgroundColor = '#8B0000'; // 와인색
        logoutButton.style.color = 'white';
    }
    
    // 사용자 이름 스타일 적용 - 진한 파란색
    if (userName) {
        userName.style.color = '#0047AB'; // 진한 파란색
        userName.style.fontWeight = 'bold';
    }
    
    // 선택항목 삭제 버튼 스타일 적용 - 진한 녹색 배경
    if (deleteSelectedButton) {
        deleteSelectedButton.style.backgroundColor = '#006400'; // 진한 녹색
        deleteSelectedButton.style.color = 'white';
        deleteSelectedButton.style.writingMode = 'horizontal-tb !important'; // 가로 방향 텍스트 강제 적용
        deleteSelectedButton.textContent = '선택항목 삭제';
    }
    
    // 추가 버튼 스타일 적용 - 가로 방향 텍스트
    if (addTodoButton) {
        addTodoButton.style.writingMode = 'horizontal-tb !important'; // 가로 방향 텍스트 강제 적용
    }
    
    // 인증 상태 확인
    todoManager.onAuthStateChanged(user => {
        if (user) {
            console.log('로그인된 사용자:', user.email);
            userName.textContent = user.displayName || user.email || 'jwj1206';
            renderTodos();
        } else {
            console.log('로그인되지 않은 상태이지만, 기본 사용자로 진행합니다.');
            // 기본 사용자 정보 설정
            todoManager.currentUser = {
                uid: 'default_user',
                displayName: 'jwj1206',
                email: 'jwj1206@example.com'
            };
            // 로컬 스토리지에 기본 사용자 저장
            localStorage.setItem('currentUser', JSON.stringify(todoManager.currentUser));
            userName.textContent = 'jwj1206';
            // 할 일 목록 초기화 및 렌더링
            todoManager.todos = todoManager.loadTodos();
            renderTodos();
        }
    });
    
    // 로그아웃 이벤트
    logoutButton.addEventListener('click', () => {
        console.log('로그아웃 버튼 클릭');
        todoManager.signOut()
            .then(() => {
                // 로그아웃 성공 시 로그인 페이지로 이동
                console.log('로그아웃 성공, 로그인 페이지로 이동');
                window.location.href = 'auth.html';
            })
            .catch(error => {
                console.error('로그아웃 오류:', error);
            });
    });
    
    // 할 일 추가 함수
    function addTodo() {
        const text = todoInput.value.trim();
        
        if (!text) return;
        
        todoManager.addTodo(text)
            .then(() => {
                todoInput.value = '';
                todoInput.focus();
                renderTodos();
            })
            .catch(error => {
                console.error('할 일 추가 오류:', error);
            });
    }
    
    // 할 일 추가 이벤트
    addTodoButton.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            addTodo();
        }
    });
    
    // 필터 변경 이벤트
    filterSelect.addEventListener('change', () => {
        currentFilter = filterSelect.value;
        renderTodos();
    });
    
    // 선택항목 삭제 함수 (완료된 항목 삭제에서 변경)
    function deleteSelected() {
        const completedTodos = todoManager.todos.filter(todo => todo.completed);
        
        if (completedTodos.length === 0) return;
        
        if (confirm('선택한 항목을 모두 삭제하시겠습니까?')) {
            todoManager.deleteSelected()
                .then(() => {
                    renderTodos();
                })
                .catch(error => {
                    console.error('선택항목 삭제 오류:', error);
                });
        }
    }
    
    // 선택항목 삭제 이벤트 (완료된 항목 삭제에서 변경)
    deleteSelectedButton.addEventListener('click', deleteSelected);
    
    // 할 일 목록 렌더링
    function renderTodos() {
        // 목록 초기화
        todoList.innerHTML = '';
        
        // 필터링된 할 일 목록
        const filteredTodos = todoManager.todos.filter(todo => {
            if (currentFilter === 'active') {
                return !todo.completed;
            } else if (currentFilter === 'completed') {
                return todo.completed;
            }
            return true;
        });
        
        // 남은 항목 수 업데이트
        const activeCount = todoManager.todos.filter(todo => !todo.completed).length;
        itemsLeft.textContent = `${activeCount}개 항목 남음`;
        
        // 할 일 항목 렌더링
        filteredTodos.forEach(todo => {
            const todoItem = document.importNode(todoItemTemplate.content, true);
            const todoItemContent = todoItem.querySelector('.todo-item-content');
            const todoText = todoItem.querySelector('.todo-text');
            const todoCheckbox = todoItem.querySelector('.todo-checkbox');
            const todoEditBtn = todoItem.querySelector('.todo-edit-btn');
            const todoDeleteBtn = todoItem.querySelector('.todo-delete-btn');

            // 할 일 내용 설정
            todoText.textContent = todo.text;
            todoCheckbox.checked = todo.completed;

            // 완료 상태에 따른 스타일 적용
            if (todo.completed) {
                todoText.classList.add('completed');
            }

            // todo-main-row 생성 (체크박스와 텍스트를 한 줄에 배치)
            const todoMainRow = document.createElement('div');
            todoMainRow.className = 'todo-main-row';
            
            // 기존 요소들을 부모에서 제거하고 todo-main-row에 추가
            todoItemContent.innerHTML = '';
            todoMainRow.appendChild(todoCheckbox);
            todoMainRow.appendChild(todoText);
            
            // todo-main-row를 todo-item-content에 추가
            todoItemContent.appendChild(todoMainRow);

            // 작성자/날짜 정보 생성
            const todoInfo = document.createElement('div');
            todoInfo.className = 'todo-info';
            
            // 날짜 포맷팅
            const createdDate = new Date(todo.createdAt);
            const formattedDate = `${createdDate.getFullYear()}-${(createdDate.getMonth() + 1).toString().padStart(2, '0')}-${createdDate.getDate().toString().padStart(2, '0')} ${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`;
            
            todoInfo.innerHTML = `
                <span class="todo-username">작성자: ${todo.userName || 'jwj1206'}</span>
                <span class="todo-date">${formattedDate}</span>
            `;

            // todo-info를 todo-item-content에 추가
            todoItemContent.appendChild(todoInfo);

            // 체크박스 이벤트
            todoCheckbox.addEventListener('change', () => {
                toggleTodoCompleted(todo.id, todoCheckbox.checked);
            });

            // 수정 버튼 이벤트
            todoEditBtn.addEventListener('click', () => {
                editTodo(todo.id, todo.text);
            });

            // 삭제 버튼 이벤트
            todoDeleteBtn.addEventListener('click', () => {
                deleteTodo(todo.id);
            });

            // 할 일 항목 추가
            todoList.appendChild(todoItem);
        });
    }

    // 할 일 완료 상태 토글
    function toggleTodoCompleted(id, completed) {
        todoManager.toggleTodoCompleted(id, completed)
            .then(() => {
                renderTodos();
            })
            .catch(error => {
                console.error('할 일 상태 변경 오류:', error);
            });
    }
    
    // 할 일 수정
    function editTodo(id, currentText) {
        const newText = prompt('할 일 수정', currentText);
        
        if (newText !== null && newText.trim() !== '') {
            todoManager.updateTodo(id, newText.trim())
                .then(() => {
                    renderTodos();
                })
                .catch(error => {
                    console.error('할 일 수정 오류:', error);
                });
        }
    }
    
    // 할 일 삭제
    function deleteTodo(id) {
        if (confirm('이 할 일을 삭제하시겠습니까?')) {
            todoManager.deleteTodo(id)
                .then(() => {
                    renderTodos();
                })
                .catch(error => {
                    console.error('할 일 삭제 오류:', error);
                });
        }
    }

    // todos-updated 이벤트 리스너 추가 (Firebase 데이터 변경 시 UI 업데이트)
    window.addEventListener('todos-updated', () => {
        renderTodos();
    });

}
