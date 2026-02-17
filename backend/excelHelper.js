const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelFilePath = path.join(__dirname, '../data/hostel_data.xlsx');

class ExcelHelper {
  static initExcelFile() {
    if (!fs.existsSync(excelFilePath)) {
      const wb = XLSX.utils.book_new();
      const summaryData = [
        ['Hostel Fee Management System - Summary Report'],
        ['Generated Date:', new Date().toLocaleString()],
        [],
        ['Total Students', 'Paid Members', 'Due Members', 'Total Collection', 'Due Amount']
      ];
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      const monthlyData = [
        ['Student Details and Fee Payment Status'],
        [],
        ['Username', 'Full Name', 'Room No', 'Month', 'Year', 'Amount', 'Status', 'Payment Date']
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Details');
      XLSX.writeFile(wb, excelFilePath);
    }
  }

  static async updateExcelFile(users, payments) {
    try {
      const wb = XLSX.readFile(excelFilePath);
      const totalStudents = users.length;
      const paidMembers = payments.filter(p => p.status === 'paid').length;
      const dueMembers = totalStudents - paidMembers;
      const totalCollection = payments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
      const dueAmount = (totalStudents * 12 * 500) - totalCollection;

      const summaryData = [
        ['Hostel Fee Management System - Summary Report'],
        ['Last Updated:', new Date().toLocaleString()],
        [],
        ['Total Students', 'Paid Members', 'Due Members', 'Total Collection', 'Due Amount'],
        [totalStudents, paidMembers, dueMembers, `₹${totalCollection}`, `₹${dueAmount}`],
        [],
        ['Monthly Breakdown:'],
        ['Month', 'Paid Count', 'Due Count', 'Collection']
      ];

      for (let month = 1; month <= 12; month++) {
        const monthPaid = payments.filter(p => p.month === month && p.status === 'paid').length;
        const monthDue = totalStudents - monthPaid;
        const monthCollection = monthPaid * 500;
        summaryData.push([this.getMonthName(month), monthPaid, monthDue, `₹${monthCollection}`]);
      }

      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      wb.Sheets['Summary'] = ws1;

      const detailsData = [
        ['Student Details and Fee Payment Status'],
        ['Generated:', new Date().toLocaleString()],
        [],
        ['Username', 'Full Name', 'Room No', 'Month', 'Year', 'Amount', 'Status', 'Payment Date']
      ];

      users.forEach(user => {
        for (let month = 1; month <= 12; month++) {
          const payment = payments.find(p => p.user_id === user.id && p.month === month);
          const currentYear = new Date().getFullYear();
          detailsData.push([
            user.username,
            user.full_name,
            user.room_number,
            this.getMonthName(month),
            currentYear,
            '₹500',
            payment && payment.status === 'paid' ? 'Paid' : 'Due',
            payment ? new Date(payment.payment_date).toLocaleString() : '-'
          ]);
        }
      });

      const ws2 = XLSX.utils.aoa_to_sheet(detailsData);
      wb.Sheets['Monthly Details'] = ws2;

      XLSX.writeFile(wb, excelFilePath);
      return true;
    } catch (error) {
      console.error('Error updating Excel file:', error);
      return false;
    }
  }

  static getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  static getExcelFilePath() {
    return excelFilePath;
  }
}

module.exports = ExcelHelper;