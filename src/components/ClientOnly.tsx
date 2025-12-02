import { ReactNode, useEffect, useState } from 'react';

interface ClientOnlyProps {
	children: ReactNode;
	fallback?: ReactNode;
}

export const ClientOnly: React.FC<ClientOnlyProps> = ({ children, fallback = null }) => {
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

	if (!hasMounted) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
};
