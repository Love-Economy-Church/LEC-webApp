import { useNavigate, useLocation } from 'react-router-dom'

const ROUTES = ['/', '/directory', '/mindmap', '/attendance', '/profile']

export function useSwipeNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const currentIndex = ROUTES.indexOf(location.pathname)

  const onSwipeLeft = () => {
    if (currentIndex < ROUTES.length - 1) {
      navigate(ROUTES[currentIndex + 1])
    }
  }

  const onSwipeRight = () => {
    if (currentIndex > 0) {
      navigate(ROUTES[currentIndex - 1])
    }
  }

  return { onSwipeLeft, onSwipeRight, currentIndex }
}
