import { Component, Input, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RestApiService } from '../../services/rest-api.service';

@Component({
  selector: 'app-domain-dialog',
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './domain-dialog.component.html',
  styleUrl: './domain-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true
})
export class DomainDialogComponent implements OnInit {
  server: string = '';
  page: string = '';
  errorMessage: string = '';
  constructor(public dialogRef: MatDialogRef<DomainDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
        title: string,
        message: string,
        placeholder: string,
        confirmText: string,
        cancelText: string,
        domain: string, 
        page: string }
  ) {}
 
  ngOnInit(): void {
    this.server = this.data.domain.trim()
    this.page = this.data.page;
  }

  saveDomain() {
    // if (this.server.trim() && this.validateDomain(this.server.trim())) {
      if (this.server.trim()) {
      this.dialogRef.close({page: this.page, server: this.server}); // Pass domain back to main component
      this.errorMessage = '';
    }else{
      this.errorMessage = `Please enter a valid`;
    }
  }

//   validateDomain(domain: string): boolean {
//     const domainRegex = /^http:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/;
//     return domainRegex.test(domain);
// }
validateDomain(domain: string): boolean {
  const domainRegex = /^(http?:\/\/)(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|(\d{1,3}(\.\d{1,3}){3}))(:\d+)?(\/.*)?$/;
  return domainRegex.test(domain);
}

close(){
    this.dialogRef.close({page: this.page, server: ''}); // Pass domain back to main component
}


}
