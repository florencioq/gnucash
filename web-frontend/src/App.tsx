import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import BooksPage from './pages/BooksPage'
import CommoditiesPage from './pages/CommoditiesPage'
import AccountsPage from './pages/AccountsPage'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="nav-title">💰 GnuCash Web</h1>
            <div className="nav-links">
              <Link to="/books" className="nav-link">Livros</Link>
              <Link to="/commodities" className="nav-link">Commodities</Link>
              <Link to="/accounts" className="nav-link">Contas</Link>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<BooksPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/commodities" element={<CommoditiesPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
