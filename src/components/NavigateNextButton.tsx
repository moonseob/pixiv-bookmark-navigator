import { Button } from '@charcoal-ui/react';

interface NavigateNextButtonProps {
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}

export default function NavigationButton({
  disabled,
  label = 'Random Bookmark',
  onClick,
}: NavigateNextButtonProps) {
  return (
    <Button variant='Primary' fullWidth disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
