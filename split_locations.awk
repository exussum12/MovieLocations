function print_to_file(file) {
  if (headers[file] != "done") {
    cmdline = "head -n1  public/parsed.csv"
    cmdline | getline result
    print result > file;
    headers[file] = "done"
  }
  print $0 >> file;
}

{
    x = int($3)
    y = int($4)
    if ($3 >= -90 && $3 <= 90) {
        print_to_file("public/out/" x "/" y ".csv")
    }
}