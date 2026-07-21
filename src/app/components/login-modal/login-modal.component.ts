import { Component, EventEmitter, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatInputModule,
    MatButtonModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatCheckboxModule
  ],
  templateUrl: './login-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login-modal.component.css']
})
export class LoginModalComponent implements OnInit {
  @Output() loginSuccess = new EventEmitter<any>();
  
  activeTab: 'login' | 'register' = 'login';
  
  // Login form
  loginUsername = '';
  loginPassword = '';
  
  // Register form
  registerUsername = '';
  registerEmail = '';
  registerPassword = '';
  registerConfirmPassword = '';
  
  isLoading = false;
  
  constructor(
    private authService: AuthService,
    private dialogRef: MatDialogRef<LoginModalComponent>,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    // Any initialization logic can go here
  }
  
  onLogin(): void {
    if (!this.loginUsername || !this.loginPassword) {
      this.snackBar.open('Please fill in all fields', 'Close', {
        duration: 3000
      });
      return;
    }
    
    this.isLoading = true;
    this.authService.login(this.loginUsername, this.loginPassword).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.snackBar.open('Login successful!', 'Close', {
          duration: 3000
        });
        this.loginSuccess.emit(response.user);
        this.dialogRef.close(response.user);
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open(
          error.error?.detail || 'Login failed. Please try again.',
          'Close',
          { duration: 5000 }
        );
      }
    });
  }
  
  onRegister(): void {
    if (!this.registerUsername || !this.registerEmail || !this.registerPassword) {
      this.snackBar.open('Please fill in all fields', 'Close', {
        duration: 3000
      });
      return;
    }
    
    if (this.registerPassword !== this.registerConfirmPassword) {
      this.snackBar.open('Passwords do not match', 'Close', {
        duration: 3000
      });
      return;
    }
    
    if (this.registerPassword.length < 6) {
      this.snackBar.open('Password must be at least 6 characters', 'Close', {
        duration: 3000
      });
      return;
    }
    
    this.isLoading = true;
    this.authService.register(
      this.registerUsername,
      this.registerEmail,
      this.registerPassword
    ).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.snackBar.open('Registration successful! Please login.', 'Close', {
          duration: 3000
        });
        this.activeTab = 'login';
        this.loginUsername = this.registerUsername;
        this.registerUsername = '';
        this.registerEmail = '';
        this.registerPassword = '';
        this.registerConfirmPassword = '';
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open(
          error.error?.detail || 'Registration failed. Please try again.',
          'Close',
          { duration: 5000 }
        );
      }
    });
  }
  
  close(): void {
    this.dialogRef.close();
  }
}