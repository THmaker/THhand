import serial,sys

ser = serial.Serial("COM3", 57600)

while True:
  cmd = input()
  if cmd == "STOP":
    break
  else:
    print(cmd)
    ser.write((cmd+"\r\n").encode())

ser.close()
