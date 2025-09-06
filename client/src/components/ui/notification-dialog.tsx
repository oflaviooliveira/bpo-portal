import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  actionText?: string;
}

export function NotificationDialog({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  actionText = 'Entendi'
}: NotificationDialogProps) {
  const getIconAndStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          titleColor: 'text-green-800',
          bgColor: 'bg-green-50 border-green-200'
        };
      case 'error':
        return {
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          titleColor: 'text-red-800',
          bgColor: 'bg-red-50 border-red-200'
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
          titleColor: 'text-orange-800',
          bgColor: 'bg-orange-50 border-orange-200'
        };
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          titleColor: 'text-blue-800',
          bgColor: 'bg-blue-50 border-blue-200'
        };
    }
  };

  const { icon, titleColor, bgColor } = getIconAndStyles();

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={`sm:max-w-md border-2 ${bgColor}`}>
        <AlertDialogHeader>
          <div className="flex items-center space-x-3">
            {icon}
            <AlertDialogTitle className={titleColor}>
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground ml-9">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={onClose}
            className="bg-gquicks-primary hover:bg-gquicks-primary/90 text-white"
          >
            {actionText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}